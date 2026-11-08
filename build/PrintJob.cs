using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

internal sealed class JobConfig
{
    public string printer { get; set; }
    public string paper { get; set; }
    public bool landscape { get; set; }
    public bool color { get; set; }
    public string duplex { get; set; }
    public int copies { get; set; }
    public List<string> images { get; set; }
    public List<bool> orientations { get; set; }
    public string outputFile { get; set; }
}

internal static class PrintJob
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length < 1 || !File.Exists(args[0]))
        {
            Console.Error.WriteLine("缺少打印任务配置。");
            return 2;
        }

        JobConfig cfg;
        try
        {
            var json = File.ReadAllText(args[0], Encoding.UTF8);
            cfg = new JavaScriptSerializer().Deserialize<JobConfig>(json);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("配置解析失败：" + ex.Message);
            return 3;
        }

        if (cfg == null || cfg.images == null || cfg.images.Count == 0)
        {
            Console.Error.WriteLine("任务没有页面图像。");
            return 4;
        }

        try
        {
            using (var doc = new PrintDocument())
            {
                doc.PrintController = new StandardPrintController();
                doc.PrinterSettings.PrinterName = cfg.printer;
                if (!doc.PrinterSettings.IsValid)
                {
                    Console.Error.WriteLine("打印机无效：" + cfg.printer);
                    return 5;
                }

                doc.PrinterSettings.Copies = (short)Math.Max(1, Math.Min(99, cfg.copies));
                doc.PrinterSettings.Collate = true;
                if (!string.IsNullOrWhiteSpace(cfg.outputFile))
                {
                    doc.PrinterSettings.PrintToFile = true;
                    doc.PrinterSettings.PrintFileName = cfg.outputFile;
                }

                if (string.Equals(cfg.duplex, "shortEdge", StringComparison.OrdinalIgnoreCase))
                    doc.PrinterSettings.Duplex = Duplex.Horizontal;
                else if (string.Equals(cfg.duplex, "longEdge", StringComparison.OrdinalIgnoreCase))
                    doc.PrinterSettings.Duplex = Duplex.Vertical;
                else
                    doc.PrinterSettings.Duplex = Duplex.Simplex;

                var paper = FindPaper(doc.PrinterSettings, cfg.paper, cfg.landscape);
                doc.DefaultPageSettings.PaperSize = paper;
                doc.DefaultPageSettings.Landscape = cfg.landscape;
                doc.DefaultPageSettings.Color = cfg.color;
                doc.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);

                int orientationIndex = 0;
                doc.QueryPageSettings += (sender, e) =>
                {
                    bool landscape = cfg.landscape;
                    if (cfg.orientations != null && cfg.orientations.Count > 0)
                        landscape = cfg.orientations[Math.Min(orientationIndex, cfg.orientations.Count - 1)];
                    e.PageSettings.Landscape = landscape;
                    orientationIndex += 1;
                };

                int index = 0;
                doc.PrintPage += (sender, e) =>
                {
                    string path = cfg.images[index];
                    using (var image = Image.FromFile(path))
                    {
                        e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                        e.Graphics.SmoothingMode = SmoothingMode.HighQuality;
                        e.Graphics.DrawImage(image, e.PageBounds);
                    }
                    index += 1;
                    e.HasMorePages = index < cfg.images.Count;
                };

                doc.Print();
            }
            Console.WriteLine("{\"ok\":true}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            return 6;
        }
    }

    private static PaperSize FindPaper(PrinterSettings settings, string name, bool landscape)
    {
        string wanted = string.IsNullOrWhiteSpace(name) ? "A4" : name.Trim().ToUpperInvariant();
        string[] aliases;
        switch (wanted)
        {
            case "5寸": aliases = new[] { "5寸", "3.5 X 5", "9 X 13" }; break;
            case "6寸": aliases = new[] { "6寸", "4 X 6", "10 X 15" }; break;
            case "7寸": aliases = new[] { "7寸", "5 X 7", "13 X 18" }; break;
            case "8寸": aliases = new[] { "8寸", "6 X 8", "15 X 20" }; break;
            default: aliases = new[] { wanted }; break;
        }
        foreach (PaperSize paper in settings.PaperSizes)
        {
            if (paper.PaperName == null) continue;
            string paperName = paper.PaperName.ToUpperInvariant();
            foreach (string alias in aliases)
            {
                if (paperName.Contains(alias)) return paper;
            }
        }

        // Exact fallbacks in hundredths of an inch.
        switch (wanted)
        {
            case "A3": return new PaperSize("A3", 1169, 1654);
            case "A5": return new PaperSize("A5", 583, 827);
            case "5寸": return new PaperSize("9x13cm", 350, 500);
            case "6寸": return new PaperSize("10x15cm", 400, 600);
            case "7寸": return new PaperSize("13x18cm", 500, 700);
            case "8寸": return new PaperSize("15x20cm", 600, 800);
            case "LETTER": return new PaperSize("Letter", 850, 1100);
            default: return new PaperSize("A4", 827, 1169);
        }
    }
}
