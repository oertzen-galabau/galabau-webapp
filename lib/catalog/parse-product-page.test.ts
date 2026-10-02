import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseProductPageHtml } from './parse-product-page';

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Fallback Title</title>
  <meta property="og:title" content="OG Work Jacket" />
  <meta property="product:price:amount" content="89,90" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "JSON-LD Name",
    "sku": "ART-123",
    "offers": { "@type": "Offer", "price": "79.00", "priceCurrency": "EUR" }
  }
  </script>
</head>
<body></body>
</html>`;

describe('parseProductPageHtml', () => {
  it('prefers JSON-LD sku and merges price sources', () => {
    const result = parseProductPageHtml(SAMPLE_HTML);
    assert.equal(result.articleNumber, 'ART-123');
    assert.equal(result.clothingStyle, 'OG Work Jacket');
    assert.equal(result.price, 89.9);
  });

  it('returns hint when nothing found', () => {
    const result = parseProductPageHtml('<html><body>empty</body></html>');
    assert.ok(result.message);
  });
});
