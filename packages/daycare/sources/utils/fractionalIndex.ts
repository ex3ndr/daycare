// License: CC0 (no rights reserved).
// Based on https://observablehq.com/@dgreensp/implementing-fractional-indexing
// Ported from https://github.com/rocicorp/fractional-indexing

export const BASE_62_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function midpoint(a: string, b: string | null, digits: string): string {
    const zero = digits[0]!;
    if (b != null && a >= b) {
        throw new Error(`${a} >= ${b}`);
    }
    if (a.endsWith(zero) || b?.endsWith(zero)) {
        throw new Error("trailing zero");
    }
    if (b) {
        let index = 0;
        while ((a[index] || zero) === b[index]) {
            index += 1;
        }
        if (index > 0) {
            return `${b.slice(0, index)}${midpoint(a.slice(index), b.slice(index), digits)}`;
        }
    }

    const digitA = a ? digits.indexOf(a[0]!) : 0;
    const digitB = b != null ? digits.indexOf(b[0]!) : digits.length;
    if (digitB - digitA > 1) {
        const middleDigit = Math.round(0.5 * (digitA + digitB));
        return digits[middleDigit]!;
    }

    if (b && b.length > 1) {
        return b.slice(0, 1);
    }

    return `${digits[digitA]}${midpoint(a.slice(1), null, digits)}`;
}

function validateInteger(value: string): void {
    if (value.length !== integerLengthGet(value[0]!)) {
        throw new Error(`invalid integer part of order key: ${value}`);
    }
}

function integerLengthGet(head: string): number {
    if (head >= "a" && head <= "z") {
        return head.charCodeAt(0) - "a".charCodeAt(0) + 2;
    }
    if (head >= "A" && head <= "Z") {
        return "Z".charCodeAt(0) - head.charCodeAt(0) + 2;
    }
    throw new Error(`invalid order key head: ${head}`);
}

function integerPartGet(key: string): string {
    const length = integerLengthGet(key[0]!);
    if (length > key.length) {
        throw new Error(`invalid order key: ${key}`);
    }
    return key.slice(0, length);
}

function orderKeyValidate(key: string, digits: string): void {
    if (key === `A${digits[0]!.repeat(26)}`) {
        throw new Error(`invalid order key: ${key}`);
    }
    const integerPart = integerPartGet(key);
    const fractionalPart = key.slice(integerPart.length);
    if (fractionalPart.endsWith(digits[0]!)) {
        throw new Error(`invalid order key: ${key}`);
    }
}

function integerIncrement(value: string, digits: string): string | null {
    validateInteger(value);
    const [head, ...rest] = value.split("");
    let carry = true;
    for (let index = rest.length - 1; carry && index >= 0; index -= 1) {
        const nextDigitIndex = digits.indexOf(rest[index]!) + 1;
        if (nextDigitIndex === digits.length) {
            rest[index] = digits[0]!;
        } else {
            rest[index] = digits[nextDigitIndex]!;
            carry = false;
        }
    }

    if (!carry) {
        return `${head}${rest.join("")}`;
    }
    if (head === "Z") {
        return `a${digits[0]!}`;
    }
    if (head === "z") {
        return null;
    }

    const nextHead = String.fromCharCode(head!.charCodeAt(0) + 1);
    if (nextHead > "a") {
        rest.push(digits[0]!);
    } else {
        rest.pop();
    }
    return `${nextHead}${rest.join("")}`;
}

function integerDecrement(value: string, digits: string): string | null {
    validateInteger(value);
    const [head, ...rest] = value.split("");
    let borrow = true;
    for (let index = rest.length - 1; borrow && index >= 0; index -= 1) {
        const nextDigitIndex = digits.indexOf(rest[index]!) - 1;
        if (nextDigitIndex === -1) {
            rest[index] = digits.slice(-1);
        } else {
            rest[index] = digits[nextDigitIndex]!;
            borrow = false;
        }
    }

    if (!borrow) {
        return `${head}${rest.join("")}`;
    }
    if (head === "a") {
        return `Z${digits.slice(-1)}`;
    }
    if (head === "A") {
        return null;
    }

    const nextHead = String.fromCharCode(head!.charCodeAt(0) - 1);
    if (nextHead < "Z") {
        rest.push(digits.slice(-1));
    } else {
        rest.pop();
    }
    return `${nextHead}${rest.join("")}`;
}

export function generateKeyBetween(a: string | null, b: string | null, digits: string = BASE_62_DIGITS): string {
    if (a != null) {
        orderKeyValidate(a, digits);
    }
    if (b != null) {
        orderKeyValidate(b, digits);
    }
    if (a != null && b != null && a >= b) {
        throw new Error(`${a} >= ${b}`);
    }

    if (a == null) {
        if (b == null) {
            return `a${digits[0]!}`;
        }

        const integerPart = integerPartGet(b);
        const fractionalPart = b.slice(integerPart.length);
        if (integerPart === `A${digits[0]!.repeat(26)}`) {
            return `${integerPart}${midpoint("", fractionalPart, digits)}`;
        }
        if (integerPart < b) {
            return integerPart;
        }
        const decremented = integerDecrement(integerPart, digits);
        if (decremented == null) {
            throw new Error("cannot decrement any more");
        }
        return decremented;
    }

    if (b == null) {
        const integerPart = integerPartGet(a);
        const fractionalPart = a.slice(integerPart.length);
        const incremented = integerIncrement(integerPart, digits);
        return incremented == null ? `${integerPart}${midpoint(fractionalPart, null, digits)}` : incremented;
    }

    const integerA = integerPartGet(a);
    const fractionalA = a.slice(integerA.length);
    const integerB = integerPartGet(b);
    const fractionalB = b.slice(integerB.length);
    if (integerA === integerB) {
        return `${integerA}${midpoint(fractionalA, fractionalB, digits)}`;
    }

    const incremented = integerIncrement(integerA, digits);
    if (incremented == null) {
        throw new Error("cannot increment any more");
    }
    if (incremented < b) {
        return incremented;
    }
    return `${integerA}${midpoint(fractionalA, null, digits)}`;
}

export function generateNKeysBetween(
    a: string | null,
    b: string | null,
    count: number,
    digits: string = BASE_62_DIGITS
): string[] {
    if (count === 0) {
        return [];
    }
    if (count === 1) {
        return [generateKeyBetween(a, b, digits)];
    }
    if (b == null) {
        let current = generateKeyBetween(a, b, digits);
        const results = [current];
        for (let index = 0; index < count - 1; index += 1) {
            current = generateKeyBetween(current, b, digits);
            results.push(current);
        }
        return results;
    }
    if (a == null) {
        let current = generateKeyBetween(a, b, digits);
        const results = [current];
        for (let index = 0; index < count - 1; index += 1) {
            current = generateKeyBetween(a, current, digits);
            results.push(current);
        }
        results.reverse();
        return results;
    }

    const middle = generateKeyBetween(a, b, digits);
    const leftCount = Math.floor((count - 1) / 2);
    const rightCount = count - leftCount - 1;
    return [
        ...generateNKeysBetween(a, middle, leftCount, digits),
        middle,
        ...generateNKeysBetween(middle, b, rightCount, digits)
    ];
}
