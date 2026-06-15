/**
 * Biker Receipt OCR Text Parser
 * Extracts merchant name, items list, and total amount from raw OCR text.
 */

export interface ParsedReceipt {
  merchantName: string;
  totalAmount: number;
  items: { name: string; price: number }[];
}

export function parseReceiptText(text: string, defaultCurrency: 'USD' | 'ZMW' = 'USD'): ParsedReceipt {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let merchantName = 'Unknown Merchant';
  let totalAmount = 0.0;
  const items: { name: string; price: number }[] = [];

  // 1. Detect Merchant Name
  const merchantKeywords = [
    { name: 'SPAR', keywords: ['spar', 'superspar'] },
    { name: 'Pick n Pay', keywords: ['pick', 'pay', 'pnp'] },
    { name: 'OK Supermarket', keywords: ['ok store', 'ok super', 'ok harare', 'ok lusaka'] },
    { name: 'Choppies', keywords: ['choppies'] },
    { name: 'Food Lovers Market', keywords: ['food lover', 'foodlovers'] },
    { name: 'Bon Marche', keywords: ['marche', 'bonmarche'] },
    { name: 'Simbisa Foods', keywords: ['simbisa', 'chicken inn', 'pizza inn', 'bakers inn'] },
  ];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const match = merchantKeywords.find(m => m.keywords.some(k => lowerLine.includes(k)));
    if (match) {
      merchantName = match.name;
      break;
    }
  }

  // 2. Parse Items & Total
  // Look for lines that look like: "ITEM_NAME ... 12.34" or "QTY x ITEM_NAME ... 12.34"
  // Look for total keywords: "total", "balance due", "amount due", "net total", "cash paid", "usd", "zmw"
  
  const totalKeywords = [
    'total', 'due', 'balance', 'bal', 'net', 'cash', 'paid', 'zmw', 'zk', 'usd', 'amount'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Check if this line indicates the Total
    const isTotalLine = totalKeywords.some(keyword => lowerLine.includes(keyword)) && 
                        !lowerLine.includes('subtotal') && 
                        !lowerLine.includes('sub-total');

    // Regex to extract decimal number from the end of the line
    const priceMatch = line.match(/(?:[$\s]|^)(ZMW|ZK|USD)?\s*(\d+[\.,]\d{2})(?!\d)/i);
    
    if (priceMatch) {
      const priceVal = parseFloat(priceMatch[2].replace(',', '.'));
      
      if (isTotalLine) {
        // If we find a total line, prioritize the largest value as the total
        if (priceVal > totalAmount) {
          totalAmount = priceVal;
        }
      } else {
        // Otherwise, it might be an item line
        // Extract the name part by stripping the price
        const namePart = line.substring(0, line.indexOf(priceMatch[0])).trim()
          .replace(/[\*#\.:_=\-]/g, '') // remove symbols
          .replace(/\b(qty|x)\b/gi, '') // remove qty labels
          .trim();

        // Ensure the name is at least 3 chars and is not purely numbers or total keywords
        if (namePart.length >= 3 && 
            isNaN(Number(namePart)) && 
            !totalKeywords.some(k => namePart.toLowerCase().includes(k))) {
          items.push({ name: namePart, price: priceVal });
        }
      }
    }
  }

  // Fallback: If no explicit total line was found, set total to sum of parsed items
  if (totalAmount === 0 && items.length > 0) {
    totalAmount = items.reduce((sum, item) => sum + item.price, 0);
  }

  return {
    merchantName,
    totalAmount: Math.round(totalAmount * 100) / 100,
    items,
  };
}
