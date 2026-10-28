param(
    [string]$PrinterName = "POSIO QX300",
    [int]$Port = 8080
)

# Raw Win32 Spooler Printer Definition
$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool PrintBytes(string printerName, byte[] bytes) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Thermal POS Receipt";
        di.pDataType = "RAW";

        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int dwWritten = 0;
                    WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
            return true;
        }
        return false;
    }
}
"@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

function Format-ReceiptText($data) {
    $w = 42
    $sb = New-Object System.Text.StringBuilder
    $div = "-" * $w
    $eq = "=" * $w

    $restaurant = if ($data.restaurantName) { $data.restaurantName } else { "CHINESE NAWAB" }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine($restaurant.PadLeft([math]::Floor(($w + $restaurant.Length) / 2)).PadRight($w))
    if ($data.branchName) {
        [void]$sb.AppendLine($data.branchName.PadLeft([math]::Floor(($w + $data.branchName.Length) / 2)).PadRight($w))
    }
    [void]$sb.AppendLine($eq)
    
    $orderNo = "ORDER #" + $data.orderNumber
    $dateStr = (Get-Date).ToString("dd/MM/yyyy hh:mm tt")
    $line1Pad = $w - $orderNo.Length - $dateStr.Length
    if ($line1Pad -lt 1) { $line1Pad = 1 }
    [void]$sb.AppendLine($orderNo + (" " * $line1Pad) + $dateStr)

    if ($data.cashierName) {
        [void]$sb.AppendLine("Cashier: " + $data.cashierName)
    }
    [void]$sb.AppendLine($div)

    foreach ($it in $data.items) {
        $qty = "x" + $it.quantity
        $total = "Rs." + [math]::Round([double]$it.lineTotal, 2)
        $name = [string]$it.name
        $maxNameLen = $w - $qty.Length - $total.Length - 2
        if ($name.Length -gt $maxNameLen) { $name = $name.Substring(0, $maxNameLen) }
        $pad = $w - $name.Length - $qty.Length - $total.Length
        if ($pad -lt 1) { $pad = 1 }
        [void]$sb.AppendLine($name + (" " * $pad) + $qty + " " + $total)
    }
    [void]$sb.AppendLine($div)

    if ($data.discount -and [double]$data.discount -gt 0) {
        $discVal = "-Rs." + [math]::Round([double]$data.discount, 2)
        $dpad = $w - 8 - $discVal.Length
        if ($dpad -lt 1) { $dpad = 1 }
        [void]$sb.AppendLine("Discount" + (" " * $dpad) + $discVal)
        [void]$sb.AppendLine($div)
    }

    $totVal = "Rs." + [math]::Round([double]$data.total, 2)
    $tpad = $w - 5 - $totVal.Length
    if ($tpad -lt 1) { $tpad = 1 }
    [void]$sb.AppendLine("TOTAL" + (" " * $tpad) + $totVal)

    $mode = if ($data.paymentMode) { $data.paymentMode.ToString().ToUpper() } else { "CASH" }
    $mpad = $w - 8 - $mode.Length
    if ($mpad -lt 1) { $mpad = 1 }
    [void]$sb.AppendLine("Payment:" + (" " * $mpad) + $mode)

    if ($mode -eq "SPLIT" -and $data.splitDetails) {
        if ($data.splitDetails.cash) { [void]$sb.AppendLine("  Cash: Rs." + $data.splitDetails.cash) }
        if ($data.splitDetails.upi)  { [void]$sb.AppendLine("  UPI:  Rs." + $data.splitDetails.upi) }
        if ($data.splitDetails.card) { [void]$sb.AppendLine("  Card: Rs." + $data.splitDetails.card) }
    }

    [void]$sb.AppendLine($eq)
    $thanks = "** THANK YOU VISIT AGAIN **"
    [void]$sb.AppendLine($thanks.PadLeft([math]::Floor(($w + $thanks.Length) / 2)).PadRight($w))
    [void]$sb.AppendLine("`n`n`n")
    return $sb.ToString()
}

function Format-KOTText($data) {
    $w = 42
    $sb = New-Object System.Text.StringBuilder
    $div = "-" * $w
    $eq = "=" * $w

    [void]$sb.AppendLine("")
    $title = "** KITCHEN ORDER TICKET **"
    [void]$sb.AppendLine($title.PadLeft([math]::Floor(($w + $title.Length) / 2)).PadRight($w))
    [void]$sb.AppendLine($eq)
    $ord = "ORDER #" + $data.orderNumber
    [void]$sb.AppendLine($ord.PadLeft([math]::Floor(($w + $ord.Length) / 2)).PadRight($w))
    [void]$sb.AppendLine($eq)
    [void]$sb.AppendLine("Time: " + (Get-Date).ToString("hh:mm tt"))
    if ($data.cashierName) { [void]$sb.AppendLine("By  : " + $data.cashierName) }
    if ($data.branchName)  { [void]$sb.AppendLine("Table: " + $data.branchName) }
    [void]$sb.AppendLine($div)
    [void]$sb.AppendLine("ITEMS:")
    foreach ($it in $data.items) {
        $name = [string]$it.name
        $qty = "x" + $it.quantity
        $pad = $w - $name.Length - $qty.Length - 2
        if ($pad -lt 1) { $pad = 1 }
        [void]$sb.AppendLine("  " + $name + (" " * $pad) + $qty)
    }
    [void]$sb.AppendLine($eq)
    $prep = "** PLEASE PREPARE **"
    [void]$sb.AppendLine($prep.PadLeft([math]::Floor(($w + $prep.Length) / 2)).PadRight($w))
    [void]$sb.AppendLine("`n`n`n")
    return $sb.ToString()
}

# Start HTTP Listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Clear-Host
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Chinese Nawab POS - Local Thermal Print Bridge" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Status       : RUNNING & LISTENING" -ForegroundColor Green
Write-Host "  Printer Name : $PrinterName" -ForegroundColor Cyan
Write-Host "  Bridge URL   : http://127.0.0.1:$Port/print" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray
Write-Host "  Direct Thermal Printing is active!" -ForegroundColor White
Write-Host "  Keep this window open during restaurant business hours." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS headers
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq "POST" -and $request.RawUrl -eq "/print") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $body = $reader.ReadToEnd()
            $reader.Close()

            try {
                $payload = $body | ConvertFrom-Json
                $targetPrinter = if ($payload.printerName) { $payload.printerName } else { $PrinterName }
                $type = if ($payload.type) { $payload.type.ToString().ToUpper() } else { "RECEIPT" }

                $textToPrint = if ($type -eq "KOT") { Format-KOTText $payload.data } else { Format-ReceiptText $payload.data }

                # ESC/POS init + ascii text + partial cut
                $init = [byte[]]@(0x1B, 0x40)
                $textBytes = [System.Text.Encoding]::ASCII.GetBytes($textToPrint)
                $cut = [byte[]]@(0x1D, 0x56, 0x01)

                $allBytes = New-Object byte[] ($init.Length + $textBytes.Length + $cut.Length)
                [Array]::Copy($init, 0, $allBytes, 0, $init.Length)
                [Array]::Copy($textBytes, 0, $allBytes, $init.Length, $textBytes.Length)
                [Array]::Copy($cut, 0, $allBytes, $init.Length + $textBytes.Length, $cut.Length)

                $printed = [RawPrinter]::PrintBytes($targetPrinter, $allBytes)

                if ($printed) {
                    Write-Host "[$((Get-Date).ToString('hh:mm:ss tt'))]  Printed $type successfully to $targetPrinter" -ForegroundColor Green
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
                    $response.StatusCode = 200
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                } else {
                    Write-Host "[$((Get-Date).ToString('hh:mm:ss tt'))]  Failed to print to $targetPrinter (Printer not found or offline)" -ForegroundColor Red
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"Printer not found"}')
                    $response.StatusCode = 500
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                }
            } catch {
                Write-Host "Error processing print: $_" -ForegroundColor Red
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":false,"error":"' + $_.Exception.Message + '"}')
                $response.StatusCode = 500
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            }
            $response.Close()
        } else {
            $response.StatusCode = 404
            $response.Close()
        }
    }
} finally {
    $listener.Stop()
}

