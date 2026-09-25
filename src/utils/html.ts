import createDOMPurify from "dompurify";

/**
 * Escape text for use in HTML content or a quoted attribute value
 * @param text Plain text
 * @returns Escaped HTML
 */
export function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// A private instance so hooks another script adds to the global DOMPurify do not apply here
const purify = createDOMPurify(window);

// Besides scripts and event handlers, which DOMPurify removes anyway: forms could ask for
// credentials, and <style> or style attributes could restyle or cover the whole page
const SANITIZE_CONFIG = {
	FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "option"],
	FORBID_ATTR: ["style"]
};

/**
 * Sanitize HTML from the machine. Text like an M291 message can come from any G-code source,
 * including job files from third parties, and DSF sends no Content-Security-Policy, so markup that
 * runs scripts would have full access to DWC and the machine
 * @param html Untrusted HTML
 * @returns HTML with formatting markup only
 */
export function sanitizeHtml(html: string): string {
	return purify.sanitize(html, SANITIZE_CONFIG) as string;
}
