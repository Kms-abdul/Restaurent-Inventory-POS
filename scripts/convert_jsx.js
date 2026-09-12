const fs = require('fs');

const html = fs.readFileSync('../pos-app/public/index.html', 'utf8');
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
if (bodyMatch) {
  let jsx = bodyMatch[1];
  
  // Remove script tags
  jsx = jsx.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove modalRoot since it's in layout
  jsx = jsx.replace(/<div id="modalRoot"><\/div>/g, '');
  
  // class to className
  jsx = jsx.replace(/class="/g, 'className="');
  
  // for to htmlFor
  jsx = jsx.replace(/for="/g, 'htmlFor="');
  
  // Close unclosed tags
  jsx = jsx.replace(/<input([^>]*?[^\/])>/g, '<input$1 />');
  jsx = jsx.replace(/<hr([^>]*?[^\/])>/g, '<hr$1 />');
  jsx = jsx.replace(/<br([^>]*?[^\/])>/g, '<br$1 />');
  jsx = jsx.replace(/<img([^>]*?[^\/])>/g, '<img$1 />');
  
  // Special style fixing
  jsx = jsx.replace(/style="([^"]+)"/g, (match, styleString) => {
    const styleObj = {};
    styleString.split(';').forEach(rule => {
      if (!rule.trim()) return;
      const [key, value] = rule.split(':');
      if (key && value) {
        const camelKey = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
        styleObj[camelKey] = value.trim();
      }
    });
    return `style={${JSON.stringify(styleObj)}}`;
  });
  
  // Write to page.tsx
  const pageTsx = `export default function POSPage() {\n  return (\n    <>\n${jsx}\n    </>\n  );\n}\n`;
  fs.writeFileSync('./src/app/page.tsx', pageTsx);
  console.log('JSX converted successfully');
}
