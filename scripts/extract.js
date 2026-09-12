const fs = require('fs');
const html = fs.readFileSync('../pos-app/public/index.html', 'utf8');
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (styleMatch) {
  const css = '@import "tailwindcss";\n\n' + styleMatch[1];
  fs.writeFileSync('./src/app/globals.css', css);
  console.log('CSS Extracted successfully');
}
