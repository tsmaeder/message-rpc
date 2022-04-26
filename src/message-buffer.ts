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

/**
 * A buffer maintaining a write position capable of writing primitive values
 */
export interface WriteBuffer {
    writeLength(length: number): WriteBuffer
    writeByte(byte: number): WriteBuffer
    writeNumber(value: number): WriteBuffer;
    writeInt(value: number): WriteBuffer;
    writeString(value: string): WriteBuffer;
    writeBytes(value: Uint8Array): WriteBuffer;

    /**
     * Makes any writes to the buffer permanent, for example by sending the writes over a channel.
     * You must obtain a new write buffer after committing
     */
    commit(): void;
}

export class ForwardingWriteBuffer implements WriteBuffer {
    constructor(protected readonly underlying: WriteBuffer) {
    }

    writeLength(length: number): WriteBuffer {
        this.underlying.writeLength(length);
        return this;
    }

    writeByte(byte: number): WriteBuffer {
        this.underlying.writeByte(byte);
        return this;
    }

    writeNumber(value: number): WriteBuffer {
        this.underlying.writeNumber(value);
        return this;
    }

    writeInt(value: number): WriteBuffer {
        this.underlying.writeInt(value);
        return this;
    }

    writeString(value: string): WriteBuffer {
        this.underlying.writeString(value);
        return this;
    }

    writeBytes(value: Uint8Array): WriteBuffer {
        this.underlying.writeBytes(value);
        return this;
    }

    commit() {
        this.underlying.commit();
    }
}

/**
 * A buffer maintaining a read position in a buffer containing a received message capable of 
 * reading primitive values.
 */
export interface ReadBuffer {
    readLength(): number;
    readByte(): number;
    readNumber(): number;
    readInt(): number;
    readString(): string;
    readBytes(): Uint8Array;
}