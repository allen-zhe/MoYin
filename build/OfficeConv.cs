using System;
using System.IO;
using System.Runtime.InteropServices;

internal static class OfficeConv
{
    // 单引擎转换：每次进程只尝试一个 COM 引擎，避免 Office/WPS 实例互相污染。
    // 引擎：office（Word/Excel/PowerPoint）或 wps（KWPS/KET/KWPP）。
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length < 3)
        {
            Console.Error.WriteLine("用法: MoPrint.OfficeConv.exe <输入文件> <输出pdf> <office|wps>");
            return 2;
        }
        string input = Path.GetFullPath(args[0]);
        string output = Path.GetFullPath(args[1]);
        string engine = args[2].Trim().ToLowerInvariant();
        if (!File.Exists(input))
        {
            Console.Error.WriteLine("输入文件不存在: " + input);
            return 3;
        }
        string dir = Path.GetDirectoryName(output);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
        try { if (File.Exists(output)) File.Delete(output); } catch { }

        string kind;
        switch (Path.GetExtension(input).ToLowerInvariant())
        {
            case ".doc":
            case ".docx":
            case ".rtf":
                kind = "word";
                break;
            case ".xls":
            case ".xlsx":
            case ".xlsm":
            case ".csv":
                kind = "excel";
                break;
            case ".ppt":
            case ".pptx":
            case ".pptm":
                kind = "ppt";
                break;
            default:
                Console.Error.WriteLine("不支持的格式: " + Path.GetExtension(input));
                return 4;
        }

        string error = null;
        try
        {
            Convert(engine, kind, input, output);
        }
        catch (Exception ex)
        {
            error = ex.GetType().Name + ": " + ex.Message;
        }

        // Office/WPS 常在写完 PDF 后清理 COM 时抛异常；以文件为准。
        if (WaitFor(output, 8000))
        {
            Console.WriteLine("{\"ok\":true,\"engine\":\"" + engine + "\"}");
            return 0;
        }
        Console.Error.WriteLine(error != null ? error : "转换未生成 PDF");
        return 5;
    }

    private static void Convert(string engine, string kind, string input, string output)
    {
        dynamic app = null;
        dynamic doc = null;
        try
        {
            string progId;
            if (engine == "wps")
                progId = kind == "word" ? "KWPS.Application" : kind == "excel" ? "KET.Application" : "KWPP.Application";
            else
                progId = kind == "word" ? "Word.Application" : kind == "excel" ? "Excel.Application" : "PowerPoint.Application";

            Type type = Type.GetTypeFromProgID(progId);
            if (type == null) throw new InvalidOperationException("未安装 " + progId);
            app = Activator.CreateInstance(type);

            if (kind == "word")
            {
                app.Visible = false;
                app.DisplayAlerts = 0;
                doc = app.Documents.Open(input, false, true, false);
                try { doc.SaveAs2(output, 17); } // wdFormatPDF
                catch { if (!WaitFor(output, 1500)) doc.SaveAs(output, 17); }
            }
            else if (kind == "excel")
            {
                app.Visible = false;
                app.DisplayAlerts = false;
                doc = app.Workbooks.Open(input, 0, true);
                doc.ExportAsFixedFormat(0, output); // xlTypePDF
            }
            else
            {
                doc = app.Presentations.Open(input, -1, 0, 0);
                doc.SaveAs(output, 32); // ppSaveAsPDF
            }
        }
        finally
        {
            try { if (doc != null) doc.Close(0); } catch { try { if (doc != null) doc.Close(); } catch { } }
            try { if (app != null) app.Quit(); } catch { }
            Release(doc);
            Release(app);
        }
    }

    private static bool Produced(string output)
    {
        return File.Exists(output) && new FileInfo(output).Length > 0;
    }

    private static bool WaitFor(string output, int timeoutMs)
    {
        int end = Environment.TickCount + timeoutMs;
        while (Environment.TickCount < end)
        {
            if (Produced(output)) return true;
            System.Threading.Thread.Sleep(200);
        }
        return Produced(output);
    }

    private static void Release(object obj)
    {
        try
        {
            if (obj != null && Marshal.IsComObject(obj)) Marshal.ReleaseComObject(obj);
        }
        catch { }
    }
}
