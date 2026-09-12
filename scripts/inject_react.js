const fs = require('fs');
let jsx = fs.readFileSync('./src/app/page.tsx', 'utf8');

// 1. Fix comments
jsx = jsx.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

// 2. Inject React state and Components at the top
const reactImports = `"use client";\n\nimport { useState, useEffect } from "react";\nimport { createClient } from "@/utils/supabase/client";\nimport LoginScreen from "@/components/LoginScreen";\nimport TopNavigation from "@/components/TopNavigation";\nimport OrderTab from "@/components/OrderTab";\nimport MenuTab from "@/components/MenuTab";\nimport KitchenTab from "@/components/KitchenTab";\nimport ReportsTab from "@/components/ReportsTab";\nimport StaffTab from "@/components/StaffTab";\nimport PrinterTab from "@/components/PrinterTab";\nimport KOTTab from "@/components/KOTTab";\nimport ReceiptTab from "@/components/ReceiptTab";\n\nexport default function POSPage() {\n  const [user, setUser] = useState<any>(null);\n  const [activeTab, setActiveTab] = useState("order");\n  const [loading, setLoading] = useState(true);\n  \n  const supabase = createClient();\n\n  useEffect(() => {\n    const checkSession = async () => {\n      const { data: { session } } = await supabase.auth.getSession();\n      if (session?.user) {\n        const { data: profile } = await supabase\n          .from("profiles")\n          .select("*")\n          .eq("id", session.user.id)\n          .single();\n        setUser({ ...session.user, profile });\n      }\n      setLoading(false);\n    };\n    checkSession();\n  }, []);\n\n  const handleLogout = async () => {\n    await supabase.auth.signOut();\n    setUser(null);\n  };\n\n  if (loading) return null;\n\n  if (!user) return <LoginScreen onLogin={setUser} />;\n\n  return (\n    <>\n`;

jsx = jsx.replace(/export default function POSPage\(\) \{\n  return \(\n    <>\n/, reactImports);

// 3. Remove the static login overlay completely
jsx = jsx.replace(/<div className="login-overlay"[^>]*>[\s\S]*?<\/div>\s*<\/noscript>\s*<\/form>\s*<\/div>/, '');

// 4. Replace <header> and <nav> with <TopNavigation>
jsx = jsx.replace(/<header className="pos-header">[\s\S]*?<\/nav>/, `<TopNavigation user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />`);

// 5. Remove hidden class from posApp
jsx = jsx.replace('<div className="pos-container hidden" id="posApp">', '<div className="pos-container" id="posApp">');

// 6. Replace Tabs HTML with React components
const orderTabRegex = /\{\/\* ORDER \*\/\}\s*<div id="orderTab"[^>]*>[\s\S]*?(?=\{\/\* MENU \*\/\})/g;
jsx = jsx.replace(orderTabRegex, `<OrderTab active={activeTab === 'order'} />\n\n                `);

const menuTabRegex = /\{\/\* MENU \*\/\}\s*<div id="menuTab"[^>]*>[\s\S]*?(?=\{\/\* KOT \*\/\})/g;
jsx = jsx.replace(menuTabRegex, `<MenuTab active={activeTab === 'menu'} />\n\n                `);

const kotTabRegex = /\{\/\* KOT \*\/\}\s*<div id="kotTab"[^>]*>[\s\S]*?(?=\{\/\* RECEIPT \*\/\})/g;
jsx = jsx.replace(kotTabRegex, `<KOTTab active={activeTab === 'kot'} />\n\n                `);

const receiptTabRegex = /\{\/\* RECEIPT \*\/\}\s*<div id="receiptTab"[^>]*>[\s\S]*?(?=\{\/\* KITCHEN KDS \*\/\})/g;
jsx = jsx.replace(receiptTabRegex, `<ReceiptTab active={activeTab === 'receipt'} />\n\n                `);

const kitchenTabRegex = /\{\/\* KITCHEN KDS \*\/\}\s*<div id="kitchenTab"[^>]*>[\s\S]*?(?=\{\/\* REPORTS \*\/\})/g;
jsx = jsx.replace(kitchenTabRegex, `<KitchenTab active={activeTab === 'kitchen'} />\n\n                `);

const reportsTabRegex = /\{\/\* REPORTS \*\/\}\s*<div id="reportsTab"[^>]*>[\s\S]*?(?=\{\/\* STAFF \*\/\})/g;
jsx = jsx.replace(reportsTabRegex, `<ReportsTab active={activeTab === 'reports'} />\n\n                `);

const staffTabRegex = /\{\/\* STAFF \*\/\}\s*<div id="staffTab"[^>]*>[\s\S]*?(?=\{\/\* PRINTER \*\/\})/g;
jsx = jsx.replace(staffTabRegex, `<StaffTab active={activeTab === 'staff'} />\n\n                `);

const printerTabRegex = /\{\/\* PRINTER \*\/\}\s*<div id="printerTab"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;
jsx = jsx.replace(printerTabRegex, `<PrinterTab active={activeTab === 'printer'} />\n\n            </div>\n        </div>`);

fs.writeFileSync('./src/app/page.tsx', jsx);
console.log('React injected successfully');
