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
export interface Disposable {
    dispose(): void;
}

export interface Event<T> {
    (listener: (e: T) => any): Disposable;
}

export class Emitter<T> {
    private readonly listeners: ((e: T) => any)[] = [];

    readonly event: Event<T> = (listener: (e: T) => any): Disposable => {
        this.listeners.push(listener);
        const position = this.listeners.length;
        return {
            dispose: () => {
                this.listeners.splice(position, 1);
            }
        }
    };

    fire(value: T): void {
        this.listeners.forEach(l => l(value));
    }
}

export class Deferred<T> {
    resolve: (value: T) => void;
    reject: (error?: any) => void;

    readonly promise = new Promise<T>((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
    });
}