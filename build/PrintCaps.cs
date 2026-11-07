using System;
using System.Collections.Generic;
using System.Drawing.Printing;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;

internal static class PrintCaps
{
    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int DeviceCapabilities(string printer, string port, short capability, IntPtr output, IntPtr devMode);

    private const short DC_DUPLEX = 7;
    private const short DC_COLORDEVICE = 32;

    [STAThread]
    private static int Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        var result = new List<object>();
        try
        {
            foreach (string name in PrinterSettings.InstalledPrinters)
            {
                var entry = new Dictionary<string, object>();
                entry["name"] = name;
                entry["displayName"] = name;
                try
                {
                    var ps = new PrinterSettings { PrinterName = name };
                    entry["isValid"] = ps.IsValid;
                    entry["isDefault"] = ps.IsDefaultPrinter;

                    // PrinterSettings.SupportsColor is wrong for several drivers
                    // (notably some monochrome HP LaserJets). Ask the driver's
                    // DeviceCapabilities directly for color and duplex support.
                    int colorCap = DeviceCapabilities(name, null, DC_COLORDEVICE, IntPtr.Zero, IntPtr.Zero);
                    int duplexCap = DeviceCapabilities(name, null, DC_DUPLEX, IntPtr.Zero, IntPtr.Zero);
                    entry["supportsColor"] = colorCap >= 0 ? colorCap != 0 : ps.SupportsColor;
                    entry["canDuplex"] = duplexCap > 0 || ps.CanDuplex;

                    var papers = new List<object>();
                    int maxW = 0;
                    int maxH = 0;
                    foreach (PaperSize paper in ps.PaperSizes)
                    {
                        papers.Add(new Dictionary<string, object>
                        {
                            { "name", paper.PaperName },
                            { "width", paper.Width },
                            { "height", paper.Height },
                            { "kind", paper.RawKind }
                        });
                        if ((long)paper.Width * paper.Height > (long)maxW * maxH)
                        {
                            maxW = paper.Width;
                            maxH = paper.Height;
                        }
                    }
                    entry["papers"] = papers;
                    entry["maxWidth"] = maxW;
                    entry["maxHeight"] = maxH;
                }
                catch (Exception ex)
                {
                    entry["error"] = ex.Message;
                }
                result.Add(entry);
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 1;
        }

        var serializer = new JavaScriptSerializer();
        Console.WriteLine(serializer.Serialize(new Dictionary<string, object> { { "printers", result } }));
        return 0;
    }
}
