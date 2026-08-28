/**
 * Small CSV helpers shared by the popup and tests.
 */
const CsvUtils = (function () {
    'use strict';

    /**
     * Escapes a value according to RFC 4180 and neutralizes spreadsheet
     * formula prefixes that could execute when a CSV is opened.
     * @param {unknown} value
     * @returns {string}
     */
    function escapeField(value) {
        let text = value == null ? '' : String(value);

        if (/^[=+\-@\t\r]/.test(text)) {
            text = `'${text}`;
        }

        return `"${text.replace(/"/g, '""')}"`;
    }

    /**
     * Serializes rows into an RFC 4180-compatible CSV string.
     * @param {unknown[][]} rows
     * @returns {string}
     */
    function serialize(rows) {
        return rows.map((row) => row.map(escapeField).join(',')).join('\r\n');
    }

    return Object.freeze({ escapeField, serialize });
})();

if (typeof window !== 'undefined') {
    window.CsvUtils = CsvUtils;
}
