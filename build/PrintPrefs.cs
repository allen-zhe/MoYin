using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal static class PrintPrefs
{
    private const int DM_PROMPT = 0x00000004;
    private const int DM_OUT_BUFFER = 0x00000002;
    private const int DM_IN_BUFFER = 0x00000008;

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool OpenPrinter(string printerName, out IntPtr hPrinter, IntPtr defaults);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int DocumentProperties(
        IntPtr hwnd,
        IntPtr hPrinter,
        string deviceName,
        IntPtr output,
        IntPtr input,
        int mode);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length < 1 || string.IsNullOrWhiteSpace(args[0]))
        {
            MessageBox.Show("缺少打印机名称。", "墨印 · 打印机首选项", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 2;
        }

        string printerName = args[0];
        IntPtr hPrinter = IntPtr.Zero;
        IntPtr devMode = IntPtr.Zero;
        try
        {
            if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            {
                int err = Marshal.GetLastWin32Error();
                MessageBox.Show("无法打开打印机：" + printerName + "\nWindows 错误码：" + err,
                    "墨印 · 打印机首选项", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 3;
            }

            int size = DocumentProperties(IntPtr.Zero, hPrinter, printerName, IntPtr.Zero, IntPtr.Zero, 0);
            if (size <= 0)
            {
                MessageBox.Show("无法读取打印机驱动配置。", "墨印 · 打印机首选项",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 4;
            }

            devMode = Marshal.AllocHGlobal(size);
            int fill = DocumentProperties(IntPtr.Zero, hPrinter, printerName, devMode, IntPtr.Zero, DM_OUT_BUFFER);
            if (fill < 0)
            {
                MessageBox.Show("无法初始化打印机驱动配置。", "墨印 · 打印机首选项",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 5;
            }

            int result = DocumentProperties(
                GetForegroundWindow(),
                hPrinter,
                printerName,
                devMode,
                devMode,
                DM_IN_BUFFER | DM_OUT_BUFFER | DM_PROMPT);

            return result >= 0 ? 0 : 6;
        }
        catch (Exception ex)
        {
            MessageBox.Show("打开打印机首选项失败：" + ex.Message, "墨印 · 打印机首选项",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 7;
        }
        finally
        {
            if (devMode != IntPtr.Zero) Marshal.FreeHGlobal(devMode);
            if (hPrinter != IntPtr.Zero) ClosePrinter(hPrinter);
        }
    }
}
