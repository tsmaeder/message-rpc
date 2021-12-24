/********************************************************************************
 * Copyright (C) 2021 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import { ReadBuffer, WriteBuffer } from './message-buffer';

export interface SerializedError {
    readonly $isError: true;
    readonly name: string;
    readonly message: string;
    readonly stack: string;
}

export const enum MessageType {
    Request = 1,
    Notification = 2,
    Reply = 3,
    ReplyErr = 4,
    Cancel = 5,
}

export class CancelMessage {
    type: MessageType.Cancel;
    id: number;
}

export class RequestMessage {
    type: MessageType.Request;
    id: number;
    method: string;
    args: any[];
}

export class NotificationMessage {
    type: MessageType.Notification;
    id: number;
    method: string;
    args: any[];
}

export class ReplyMessage {
    type: MessageType.Reply;
    id: number;
    res: any;
}

export class ReplyErrMessage {
    type: MessageType.ReplyErr;
    id: number;
    err: SerializedError;
}

export type RPCMessage = RequestMessage | ReplyMessage | ReplyErrMessage | CancelMessage | NotificationMessage;

enum ObjectType {
    JSON = 0,
    ByteArray = 1,
    ObjectArray = 2,
    Undefined = 3
}

export interface ValueEncoder {
    is(value: any): boolean;
    write(buf: WriteBuffer, value: any): void;
}

export interface ValueDecoder {
    read(buf: ReadBuffer): any;
}

export class MessageDecoder {
    protected decoders: Map<number, ValueDecoder> = new Map();

    constructor() {
        this.registerDecoder(ObjectType.ByteArray, {
            read: buf => {
                return buf.readBytes();
            }
        });
        this.registerDecoder(ObjectType.JSON, {
            read: buf => {
                const json = buf.readString();
                return JSON.parse(json);
            }
        });
        this.registerDecoder(ObjectType.ObjectArray, {
            read: buf => {
                return this.readArray(buf);
            }
        });

        this.registerDecoder(ObjectType.Undefined, {
            read: () => undefined
        });
    }

    registerDecoder(tag: number, decoder: ValueDecoder): void {
        if (this.decoders.has(tag)) {
            throw new Error(`Decoder already registered: ${tag}`);
        }
        this.decoders.set(tag, decoder);
    }

    parse(buf: ReadBuffer): RPCMessage {
        try {
            const msgType = buf.readByte();

            switch (msgType) {
                case MessageType.Request:
                    return this.parseRequest(buf);
                case MessageType.Notification:
                    return this.parseNotification(buf);
                case MessageType.Reply:
                    return this.parseReply(buf);
                case MessageType.ReplyErr:
                    return this.parseReplyErr(buf);
                case MessageType.Cancel:
                    return this.parseCancel(buf);
            }
            throw new Error(`Unknown message type: ${msgType}`);
        } catch (e) {
            // exception does not show problematic content: log it!
            console.log('failed to parse message: ' + buf);
            throw e;
        }
    }

    protected parseCancel(msg: ReadBuffer): CancelMessage {
        const callId = msg.readInt();
        return {
            type: MessageType.Cancel,
            id: callId
        };
    }

    protected parseRequest(msg: ReadBuffer): RequestMessage {
        const callId = msg.readInt();
        const method = msg.readString();
        let args = this.readArray(msg);
        // convert `null` to `undefined`, since we don't use `null` in internal plugin APIs
        args = args.map(arg => arg === null ? undefined : arg); // eslint-disable-line no-null/no-null

        return {
            type: MessageType.Request,
            id: callId,
            method: method,
            args: args
        };
    }

    protected parseNotification(msg: ReadBuffer): NotificationMessage {
        const callId = msg.readInt();
        const method = msg.readString();
        let args = this.readArray(msg);
        // convert `null` to `undefined`, since we don't use `null` in internal plugin APIs
        args = args.map(arg => arg === null ? undefined : arg); // eslint-disable-line no-null/no-null

        return {
            type: MessageType.Notification,
            id: callId,
            method: method,
            args: args
        };
    }

    parseReply(msg: ReadBuffer): ReplyMessage {
        const callId = msg.readInt();
        const value = this.readTypedValue(msg);
        return {
            type: MessageType.Reply,
            id: callId,
            res: value
        };
    }

    parseReplyErr(msg: ReadBuffer): ReplyErrMessage {
        const callId = msg.readInt();

        let err: any = this.readTypedValue(msg);
        if (err && err.$isError) {
            err = new Error();
            err.name = err.name;
            err.message = err.message;
            err.stack = err.stack;
        }
        return {
            type: MessageType.ReplyErr,
            id: callId,
            err: err
        };
    }

    readArray(buf: ReadBuffer): any[] {
        const length = buf.readInt();
        const result = new Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = this.readTypedValue(buf);
        }
        return result;
    }

    readTypedValue(buf: ReadBuffer): any {
        const type = buf.readInt();
        const decoder = this.decoders.get(type);
        if (!decoder) {
            throw new Error(`No decoder for tag ${type}`);
        }
        return decoder.read(buf);
    }
}

export class MessageEncoder {
    protected readonly encoders: [number, ValueEncoder][] = [];
    protected readonly registeredTags: Set<number> = new Set();

    constructor() {
        // encoders will be consulted in reverse order of registration, so the JSON fallback needs to be last
        this.registerEncoder(ObjectType.JSON, {
            is: (value) => true,
            write: (buf, value) => {
                buf.writeString(JSON.stringify(value));
            }
        });
        this.registerEncoder(ObjectType.Undefined, {
            is: (value) => (typeof value === 'undefined'),
            write: () => { }
        });

        this.registerEncoder(ObjectType.ObjectArray, {
            is: (value) => Array.isArray(value),
            write: (buf, value) => {
                this.writeArray(buf, value);
            }
        });

        this.registerEncoder(ObjectType.ByteArray, {
            is: (value) => value instanceof ArrayBuffer,
            write: (buf, value) => {
                buf.writeBytes(value);
            }
        });
    }

    registerEncoder<T>(tag: number, encoder: ValueEncoder): void {
        if (this.registeredTags.has(tag)) {
            throw new Error(`Tag already registered: ${tag}`);
        }
        this.registeredTags.add(tag);
        this.encoders.push([tag, encoder]);
    }

    cancel(buf: WriteBuffer, requestId: number): void {
        buf.writeByte(MessageType.Cancel);
        buf.writeInt(requestId);
    }

    notification(buf: WriteBuffer, requestId: number, method: string, args: any[]): void {
        buf.writeByte(MessageType.Notification);
        buf.writeInt(requestId);
        buf.writeString(method);
        this.writeArray(buf, args);
    }

    request(buf: WriteBuffer, requestId: number, method: string, args: any[]): void {
        buf.writeByte(MessageType.Request);
        buf.writeInt(requestId);
        buf.writeString(method);
        this.writeArray(buf, args);
    }

    replyOK(buf: WriteBuffer, requestId: number, res: any): void {
        buf.writeByte(MessageType.Reply);
        buf.writeInt(requestId);
        this.writeTypedValue(buf, res);
    }

    replyErr(buf: WriteBuffer, requestId: number, err: any): void {
        buf.writeByte(MessageType.ReplyErr);
        buf.writeInt(requestId);
        this.writeTypedValue(buf, err);
    }

    writeTypedValue(buf: WriteBuffer, value: any): void {
        for (let i: number = this.encoders.length - 1; i >= 0; i--) {
            if (this.encoders[i][1].is(value)) {
                buf.writeInt(this.encoders[i][0]);
                this.encoders[i][1].write(buf, value);
                return;
            }
        }
    }

    writeArray(buf: WriteBuffer, value: any[]): void {
        buf.writeInt(value.length);
        for (let i = 0; i < value.length; i++) {
            this.writeTypedValue(buf, value[i]);
        }
    }

}