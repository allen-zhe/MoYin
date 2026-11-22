using System;
using System.IO;
using System.Runtime.InteropServices;

internal static class OfficeConv
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("用法: MoPrint.OfficeConv.exe <输入文件> <输出pdf>");
            return 2;
        }
        string input = Path.GetFullPath(args[0]);
        string output = Path.GetFullPath(args[1]);
        if (!File.Exists(input))
        {
            Console.Error.WriteLine("输入文件不存在: " + input);
            return 3;
        }
        string dir = Path.GetDirectoryName(output);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);
        try { if (File.Exists(output)) File.Delete(output); } catch { }

        string ext = Path.GetExtension(input).ToLowerInvariant();
        string lastError = null;
        try
        {
            switch (ext)
            {
                case ".doc":
                case ".docx":
                case ".rtf":
                    Word(input, output);
                    break;
                case ".xls":
                case ".xlsx":
                case ".xlsm":
                case ".csv":
                    Excel(input, output);
                    break;
                case ".ppt":
                case ".pptx":
                case ".pptm":
                    PowerPoint(input, output);
                    break;
                default:
                    Console.Error.WriteLine("不支持的格式: " + ext);
                    return 4;
            }
        }
        catch (Exception ex)
        {
            lastError = ex.GetType().Name + ": " + ex.Message;
        }

        // Office 有时在写出 PDF 后清理 COM 对象时抛异常（RPC 不可用等），
        // 只要目标文件已经生成且非空，就按成功处理。
        if (File.Exists(output) && new FileInfo(output).Length > 0)
        {
            Console.WriteLine("{\"ok\":true}");
            return 0;
        }
        Console.Error.WriteLine(lastError != null ? lastError : "转换未生成 PDF");
        return 5;
    }

    private static void Word(string input, string output)
    {
        dynamic app = null;
        dynamic doc = null;
        try
        {
            app = Create("Word.Application");
            app.Visible = false;
            app.DisplayAlerts = 0;
            app.AutomationSecurity = 3; // msoAutomationSecurityForceDisable
            doc = app.Documents.Open(input, false, true, false);
            // wdFormatPDF = 17
            doc.SaveAs2(output, 17);
        }
        finally
        {
            try { if (doc != null) doc.Close(0); } catch { }
            try { if (app != null) app.Quit(0); } catch { }
            Release(doc);
            Release(app);
        }
    }

    private static void Excel(string input, string output)
    {
        dynamic app = null;
        dynamic book = null;
        try
        {
            app = Create("Excel.Application");
            app.Visible = false;
            app.DisplayAlerts = false;
            app.AutomationSecurity = 3;
            book = app.Workbooks.Open(input, 0, true);
            // xlTypePDF = 0
            book.ExportAsFixedFormat(0, output);
        }
        finally
        {
            try { if (book != null) book.Close(false); } catch { }
            try { if (app != null) app.Quit(); } catch { }
            Release(book);
            Release(app);
        }
    }

    private static void PowerPoint(string input, string output)
    {
        dynamic app = null;
        dynamic pres = null;
        try
        {
            app = Create("PowerPoint.Application");
            app.AutomationSecurity = 3;
            pres = app.Presentations.Open(input, -1, 0, 0);
            // ppSaveAsPDF = 32
            pres.SaveAs(output, 32);
        }
        finally
        {
            try { if (pres != null) pres.Close(); } catch { }
            try { if (app != null) app.Quit(); } catch { }
            Release(pres);
            Release(app);
        }
    }

    private static dynamic Create(string progId)
    {
        Type type = Type.GetTypeFromProgID(progId);
        if (type == null) throw new InvalidOperationException("未安装 " + progId + "，请安装 Microsoft Office 或 LibreOffice");
        return Activator.CreateInstance(type);
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
