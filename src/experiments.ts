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
import { MessageDecoder, MessageEncoder } from './message-encoder';
import { ArrayBufferReadBuffer, ArrrayBufferWriteBuffer } from './array-buffer-message-buffer';

/**
 * This file is for fiddling around and testing. Not production code.
 */


//onst toEncode = ['string1', 'string2'];

// Encode with stringify 
//const stringified = JSON.stringify(toEncode);
//const encoded1 = Buffer.from(stringified);
//console.log(encoded1.byteLength);

// then encoded1.byteLength= 21

// Encode with MessageEncoder
const encoder = new MessageEncoder();
//const writer = new ArrrayBufferWriteBuffer();
//encoder.writeTypedValue(writer, toEncode);
//const encoded2 = writer.getCurrentContents();
//console.log(encoded2.byteLength);
// then encoded2.byteLength=  42
// so factor 2 in this case

const test1 = {
    'curve': 'yes',
    'successful': false,
    'does': [
        [
            'tool',
            'strange',
            'declared',
            false,
            'if',
            false,
            false,
            true,
            true,
            196639994
        ],
        -1697924638.043861,
        1921422646,
        'hide',
        false,
        true,
        true,
        -400170969,
        550424783,
        -2118374202.4598904
    ],
    'fish': 664495385.6069336,
    'eat': -1205575089,
    'boat': 1495629676,
    'arm': 'nation',
    'height': false,
    'underline': 'have',
    'satellites': -20686813.87966633
};

const test2: unknown[] = [];
for (let index = 0; index < 100; index++) {
    test2.push(test1);
}

const test3: string[] = [];
for (let index = 0; index < 1000; index++) {
    test3.push(`${index}`);

}


time(10000, () => writeTypedValue(test2), 'New encoding of object');
time(10000, () => writeTypedValue(JSON.stringify(test2)), 'Stringify of object');

function writeTypedValue(object: unknown) {
    const writer = new ArrrayBufferWriteBuffer();
    encoder.writeTypedValue(writer, object);
    writer.getCurrentContents();
}

function time(times: number, payload: () => void, name: string) {
    const start2 = Date.now();
    for (let index = 0; index < times; index++) {
        payload();
        // test(test1);
        // test(test2);
        // test(test3);
    }
    const end2 = Date.now();
    console.log(`${name} took ${end2 - start2} ms.`);
}

export function test(object: unknown): void {
    // console.log('Start test');
    const encoder = new MessageEncoder();
    const decoder = new MessageDecoder();
    // const string = fs.readFileSync(process.argv[2], 'utf8');
    // const object = JSON.parse(string);

    //const start1 = Date.now();
    const result = Buffer.from(JSON.stringify(object));
    //const end1 = Date.now();
    //console.log(`Stringify encoding of object took ${end1 - start1} ms. Final byte length: ${result.byteLength}`);

    const writer = new ArrrayBufferWriteBuffer();
    //const start2 = Date.now();
    encoder.writeTypedValue(writer, object);
    const result2 = writer.getCurrentContents();
    //const end2 = Date.now();
    //console.log(`New encoding of object took ${end2 - start2} ms. Final byte length: ${result2.byteLength}`);

    //const start3 = Date.now();
    JSON.parse(result.toString());
    //const end3 = Date.now();
    //console.log(`Stringify Reading took ${end3 - start3} ms for`);

    const reader = new ArrayBufferReadBuffer(result2);
    //const start4 = Date.now();
    decoder.readTypedValue(reader);
    //const end4 = Date.now();
    //console.log(`New Reading took ${end4 - start4} ms for`);
    // console.log();
}