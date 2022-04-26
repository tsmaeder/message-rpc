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
import { Emitter, Event } from './env/event';
import { ReadBuffer, WriteBuffer } from './message-buffer';

export class ArrrayBufferWriteBuffer implements WriteBuffer {
    private encoder = new TextEncoder();
    private msg: DataView;

    constructor(private buffer: Uint8Array = new Uint8Array(1024 * 1024), private offset: number = 0) {
        this.msg = new DataView(buffer.buffer);
    }

    ensureCapacity(value: number): WriteBuffer {
        let newLength = this.buffer.byteLength;
        while (newLength < this.offset + value) {
            newLength *= 2;
        }
        if (newLength !== this.buffer.byteLength) {
            console.log("reallocating to " + newLength);
            const newBuffer = new Uint8Array(newLength);
            newBuffer.set(this.buffer);
            this.buffer = newBuffer;
            this.msg = new DataView(this.buffer.buffer);
        }
        return this;
    }

    writeLength(length: number): WriteBuffer {
        if (length < 127) {
            this.writeByte(length);
        } else {
            this.writeByte(128 + (length & 127));
            this.writeLength(length >> 7);
        }
        return this;
    }

    writeByte(value: number): WriteBuffer {
        this.ensureCapacity(1);
        this.buffer[this.offset++] = value;
        return this;
    }

    writeNumber(value: number): WriteBuffer {
        this.ensureCapacity(8);
        this.msg.setFloat64(this.offset, value);
        this.offset += 8;
        return this;
    }

    writeInt(value: number): WriteBuffer {
        this.ensureCapacity(4);
        this.msg.setUint32(this.offset, value);
        this.offset += 4;
        return this;
    }

    writeString(value: string): WriteBuffer {
        this.ensureCapacity(4 * value.length);
        const result = this.encoder.encodeInto(value, this.buffer.subarray(this.offset + 4));
        this.msg.setUint32(this.offset, result.written!);
        this.offset += 4 + result.written!;
        return this;
    }

    encodeString(value: string): Uint8Array {
        return this.encoder.encode(value);
    }

    writeBytes(value: Uint8Array): WriteBuffer {
        this.writeLength(value.byteLength);
        this.ensureCapacity(value.length);
        this.buffer.set(value, this.offset);
        this.offset += value.byteLength;
        return this;
    }

    private onCommitEmitter = new Emitter<ArrayBuffer>();
    get onCommit(): Event<ArrayBuffer> {
        return this.onCommitEmitter.event;
    }

    commit(): void {
        this.onCommitEmitter.fire(this.getCurrentContents());
    }

    getCurrentContents(): Uint8Array {
        return this.buffer.slice(0, this.offset);
    }
}

export class ArrayBufferReadBuffer implements ReadBuffer {
    private offset: number = 0;
    private msg;

    constructor(private readonly buffer: Uint8Array) {
        this.msg = new DataView(buffer.buffer);
    }

    readByte(): number {
        return this.msg.getUint8(this.offset++);
    }

    readLength(): number {
        let shift = 0;
        let byte = this.readByte();
        let value = (byte & 127) << shift;
        while (byte > 127) {
            shift += 7;
            byte = this.readByte();
            value = value + ((byte & 127) << shift);
        }
        return value;
    }

    readNumber(): number {
        const result = this.msg.getFloat64(this.offset);
        this.offset += 8;
        return result;
    }

    readInt(): number {
        const result = this.msg.getInt32(this.offset);
        this.offset += 4;
        return result;
    }

    readString(): string {
        const len = this.readInt();
        const result = this.decodeString(this.buffer.slice(this.offset, this.offset + len));
        this.offset += len;
        return result;
    }

    private decodeString(buf: ArrayBuffer): string {
        return new TextDecoder().decode(buf);
    }

    readBytes(): Uint8Array {
        const length = this.readLength();
        const result = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
    }
}