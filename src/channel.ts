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
import { ArrayBufferReadBuffer, ArrrayBufferWriteBuffer } from './array-buffer-message-buffer';
import { Emitter, Event } from './event';
import { ReadBuffer, WriteBuffer } from './message-buffer';

export interface Channel {
    onClose: Event<void>;
    onError: Event<any>;
    onMessage: Event<ReadBuffer>;
    getWriteBuffer(): WriteBuffer;
    close(): void;
}

enum MessageTypes {
    Open = 1,
    Close = 2,
    AckOpen = 3,
    Data = 4
}

export class ForwardingChannel implements Channel {
    constructor(private readonly closeHander: () => void, private readonly writeBufferSource: () => WriteBuffer) {
    }

    onCloseEmitter: Emitter<void> = new Emitter();
    get onClose(): Event<void> {
        return this.onCloseEmitter.event;
    };
    onErrorEmitter: Emitter<any> = new Emitter();
    get onError(): Event<void> {
        return this.onErrorEmitter.event;
    };
    onMessageEmitter: Emitter<ReadBuffer> = new Emitter();
    get onMessage(): Event<ReadBuffer> {
        return this.onMessageEmitter.event;
    };

    getWriteBuffer(): WriteBuffer {
        return this.writeBufferSource();
    }

    close() {
        this.closeHander();
    }
}

export class ChannelMultiplexer {
    protected pendingOpen: Map<string, (channel: ForwardingChannel) => void> = new Map();
    protected openChannels: Map<string, ForwardingChannel> = new Map();

    constructor(protected readonly underlyingChannel: Channel) {
        this.underlyingChannel.onMessage(buffer => this.handleMessage(buffer));
        this.underlyingChannel.onClose(() => this.handleClose());
        this.underlyingChannel.onError(error => this.handleError(error))
    }

    protected handleError(error: any): any {
        this.openChannels.forEach(channel => {
            channel.onErrorEmitter.fire(error);
        });
    }

    protected handleClose(): any {
        this.pendingOpen.clear();
        this.openChannels.forEach(channel => {
            channel.close();
        });
        this.openChannels.clear();
    }

    protected handleMessage(buffer: ReadBuffer): any {
        const type = buffer.readByte();
        const id = buffer.readString();
        switch (type) {
            case MessageTypes.AckOpen: {
                // it would be an error if we did not have a handler
                const resolve = this.pendingOpen.get(id);
                const channel = this.createChannel(id);
                this.pendingOpen.delete(id);
                this.openChannels.set(id, channel);
                resolve!(channel);
                break;
            }
            case MessageTypes.Open: {
                if (!this.openChannels.has(id)) {
                    const channel = this.createChannel(id);
                    this.openChannels.set(id, channel);
                    const resolve = this.pendingOpen.get(id);
                    if (resolve) {
                        // edge case: both side try to open a channel at the same time.
                        resolve(channel);
                    }
                }

                break;
            }
            case MessageTypes.Close: {
                const channel = this.openChannels.get(id);
                if (channel) {
                    channel.onCloseEmitter.fire();
                    this.openChannels.delete(id);
                }
                break;
            }
            case MessageTypes.Data: {
                const channel = this.openChannels.get(id);
                if (channel) {
                    channel.onMessageEmitter.fire(buffer);
                }
                break;
            }

        }
    }

    protected createChannel(id: string): ForwardingChannel {
        return new ForwardingChannel(() => this.closeChannel(id), () => {
            const underlying = this.underlyingChannel.getWriteBuffer();
            underlying.writeByte(MessageTypes.Data);
            underlying.writeString(id);
            return underlying;
        });
    }

    protected closeChannel(id: string): void {
        this.underlyingChannel.getWriteBuffer().writeByte(MessageTypes.Close).writeString(id).commit();
        this.openChannels.get(id)!.onCloseEmitter.fire();
        this.openChannels.delete(id);
    }

    open(id: string): Promise<Channel> {
        this.underlyingChannel.getWriteBuffer().writeByte(MessageTypes.Open).writeString(id).commit();
        return new Promise((resolve, reject) => {
            this.pendingOpen.set(id, resolve);
        });
    }
}

export class ChannelPipe {
    readonly left: ForwardingChannel = new ForwardingChannel(() => this.right.onCloseEmitter.fire(), () => {
        const leftWrite = new ArrrayBufferWriteBuffer();
        leftWrite.onCommit(buffer => {
            this.right.onMessageEmitter.fire(new ArrayBufferReadBuffer(buffer));
        });
        return leftWrite;
    });
    readonly right: ForwardingChannel = new ForwardingChannel(() => this.left.onCloseEmitter.fire(), () => {
        const rightWrite = new ArrrayBufferWriteBuffer();
        rightWrite.onCommit(buffer => {
            this.left.onMessageEmitter.fire(new ArrayBufferReadBuffer(buffer));
        })
        return rightWrite;
    });
}