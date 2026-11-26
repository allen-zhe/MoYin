using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal static class PrintPrefs
{
    private const int DM_PROMPT = 0x00000004;
    private const int DM_OUT_BUFFER = 0x00000002;
    private const int DM_IN_BUFFER = 0x00000008;

    private const int DM_ORIENTATION = 0x00000001;
    private const int DM_PAPERSIZE = 0x00000002;
    private const int DM_PAPERLENGTH = 0x00000004;
    private const int DM_PAPERWIDTH = 0x00000008;
    private const int DM_COLOR = 0x00000800;
    private const int DM_DUPLEX = 0x00001000;
    private const int DM_FORMNAME = 0x00010000;

    private const short DMDUP_SIMPLEX = 1;
    private const short DMDUP_VERTICAL = 2;
    private const short DMDUP_HORIZONTAL = 3;
    private const short DMCOLOR_MONOCHROME = 1;
    private const short DMCOLOR_COLOR = 2;
    private const short DMORIENT_PORTRAIT = 1;
    private const short DMORIENT_LANDSCAPE = 2;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DEVMODE
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
        public ushort dmSpecVersion;
        public ushort dmDriverVersion;
        public ushort dmSize;
        public ushort dmDriverExtra;
        public uint dmFields;
        public short dmOrientation;
        public short dmPaperSize;
        public short dmPaperLength;
        public short dmPaperWidth;
        public short dmScale;
        public short dmCopies;
        public short dmDefaultSource;
        public short dmPrintQuality;
        public short dmColor;
        public short dmDuplex;
        public short dmYResolution;
        public short dmTTOption;
        public short dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
        public ushort dmLogPixels;
        public uint dmBitsPerPel;
        public uint dmPelsWidth;
        public uint dmPelsHeight;
        public uint dmDisplayFlags;
        public uint dmDisplayFrequency;
        public uint dmICMMethod;
        public uint dmICMIntent;
        public uint dmMediaType;
        public uint dmDitherType;
        public uint dmReserved1;
        public uint dmReserved2;
        public uint dmPanningWidth;
        public uint dmPanningHeight;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool OpenPrinter(string printerName, out IntPtr hPrinter, IntPtr defaults);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int DocumentProperties(
        IntPtr hwnd, IntPtr hPrinter, string deviceName,
        IntPtr output, IntPtr input, int mode);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    // 参数：<printer> <outFile> [paper] [duplex] [color] [landscape] [inDevmodeFile]
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length < 2 || string.IsNullOrWhiteSpace(args[0]))
        {
            Console.Error.WriteLine("缺少打印机名称或输出文件。");
            return 2;
        }

        string printerName = args[0];
        string outFile = args[1];
        string paper = args.Length > 2 ? args[2] : "A4";
        string duplex = args.Length > 3 ? args[3] : "simplex";
        string color = args.Length > 4 ? args[4] : "color";
        bool landscape = args.Length > 5 && string.Equals(args[5], "landscape", StringComparison.OrdinalIgnoreCase);
        string inFile = args.Length > 6 ? args[6] : null;

        IntPtr hPrinter = IntPtr.Zero;
        IntPtr buffer = IntPtr.Zero;
        try
        {
            if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            {
                Console.Error.WriteLine("无法打开打印机：" + printerName + "，错误码 " + Marshal.GetLastWin32Error());
                return 3;
            }

            int size = DocumentProperties(IntPtr.Zero, hPrinter, printerName, IntPtr.Zero, IntPtr.Zero, 0);
            if (size <= 0)
            {
                Console.Error.WriteLine("无法读取打印机驱动配置。");
                return 4;
            }

            buffer = Marshal.AllocHGlobal(size);
            bool seeded = false;
            if (!string.IsNullOrEmpty(inFile) && File.Exists(inFile))
            {
                byte[] seed = File.ReadAllBytes(inFile);
                int copy = Math.Min(seed.Length, size);
                Marshal.Copy(seed, 0, buffer, copy);
                seeded = true;
            }
            if (!seeded)
            {
                if (DocumentProperties(IntPtr.Zero, hPrinter, printerName, buffer, IntPtr.Zero, DM_OUT_BUFFER) < 0)
                {
                    Console.Error.WriteLine("无法初始化打印机驱动配置。");
                    return 5;
                }
            }

            DEVMODE dm = (DEVMODE)Marshal.PtrToStructure(buffer, typeof(DEVMODE));
            ApplyItemSettings(ref dm, paper, duplex, color, landscape);
            Marshal.StructureToPtr(dm, buffer, false);

            int result = DocumentProperties(
                GetForegroundWindow(), hPrinter, printerName,
                buffer, buffer, DM_IN_BUFFER | DM_OUT_BUFFER | DM_PROMPT);

            if (result < 0)
            {
                Console.Error.WriteLine("打印机驱动首选项返回错误：" + result);
                return 6;
            }
            if (result == 2)
            {
                Console.WriteLine("{\"ok\":false,\"canceled\":true}");
                return 0;
            }

            DEVMODE finalDm = (DEVMODE)Marshal.PtrToStructure(buffer, typeof(DEVMODE));
            byte[] bytes = new byte[size];
            Marshal.Copy(buffer, bytes, 0, size);
            File.WriteAllBytes(outFile, bytes);

            // 只回报驱动真正声明过的字段。黑白驱动常常不写 DM_COLOR，
            // 此时 dmColor 是 0，若当成“彩色”回传会把打印项颜色改错。
            string outDuplex = "";
            if ((finalDm.dmFields & DM_DUPLEX) != 0)
            {
                outDuplex = finalDm.dmDuplex == DMDUP_VERTICAL ? "longEdge"
                    : finalDm.dmDuplex == DMDUP_HORIZONTAL ? "shortEdge" : "simplex";
            }
            string outColor = "";
            if ((finalDm.dmFields & DM_COLOR) != 0)
            {
                outColor = finalDm.dmColor == DMCOLOR_MONOCHROME ? "mono" : "color";
            }
            string outPaper = "";
            if ((finalDm.dmFields & DM_PAPERSIZE) != 0) outPaper = PaperName(finalDm.dmPaperSize);
            else if (finalDm.dmFields == 0 && finalDm.dmPaperSize > 0) outPaper = PaperName(finalDm.dmPaperSize);

            string json = "{"
                + "\"ok\":true,"
                + "\"duplex\":\"" + outDuplex + "\","
                + "\"color\":\"" + outColor + "\","
                + "\"paper\":\"" + outPaper + "\","
                + "\"landscape\":" + (finalDm.dmOrientation == DMORIENT_LANDSCAPE ? "true" : "false") + ","
                + "\"devmode\":\"" + Convert.ToBase64String(bytes) + "\""
                + "}";
            Console.WriteLine(json);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.GetType().Name + ": " + ex.Message);
            return 7;
        }
        finally
        {
            if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer);
            if (hPrinter != IntPtr.Zero) ClosePrinter(hPrinter);
        }
    }

    private static void ApplyItemSettings(ref DEVMODE dm, string paper, string duplex, string color, bool landscape)
    {
        dm.dmFields |= DM_ORIENTATION;
        dm.dmOrientation = landscape ? DMORIENT_LANDSCAPE : DMORIENT_PORTRAIT;

        dm.dmFields |= DM_COLOR;
        dm.dmColor = color == "mono" ? DMCOLOR_MONOCHROME : DMCOLOR_COLOR;

        dm.dmFields |= DM_DUPLEX;
        dm.dmDuplex = duplex == "longEdge" ? DMDUP_VERTICAL
            : duplex == "shortEdge" ? DMDUP_HORIZONTAL : DMDUP_SIMPLEX;

        short code = PaperCode(paper);
        if (code > 0)
        {
            dm.dmFields |= DM_PAPERSIZE | DM_FORMNAME;
            dm.dmPaperSize = code;
            dm.dmFormName = paper;
        }
        else
        {
            int[] mm = PaperMm(paper);
            if (mm != null)
            {
                dm.dmFields |= DM_PAPERWIDTH | DM_PAPERLENGTH;
                dm.dmPaperSize = 0;
                dm.dmPaperWidth = (short)mm[0];
                dm.dmPaperLength = (short)mm[1];
            }
        }
    }

    private static short PaperCode(string paper)
    {
        switch ((paper ?? string.Empty).ToUpperInvariant())
        {
            case "LETTER": return 1;
            case "LEGAL": return 5;
            case "A3": return 8;
            case "A4": return 9;
            case "A5": return 11;
            default: return 0;
        }
    }

    private static int[] PaperMm(string paper)
    {
        switch (paper)
        {
            case "5寸": return new[] { 89, 127 };
            case "6寸": return new[] { 102, 152 };
            case "7寸": return new[] { 127, 178 };
            case "8寸": return new[] { 152, 203 };
            default: return null;
        }
    }

    private static string PaperName(short code)
    {
        switch (code)
        {
            case 1: return "Letter";
            case 5: return "Legal";
            case 8: return "A3";
            case 9: return "A4";
            case 11: return "A5";
            default: return "";
        }
    }
}
