using System;
using Inventor;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.IO;

namespace debugPluginLocally
{
    class Program
    {
        static void Main(string[] args)
        {
            using (var inv = new InventorConnector())
            {
                InventorServer server = inv.GetInventorServer();

                try
                {
                    Console.WriteLine("Running locally...");
                    // run the plugin
                    DebugSamplePlugin(server);
                }
                catch (Exception e)
                {
                    string message = $"Exception: {e.Message}";
                    if (e.InnerException != null)
                        message += $"{System.Environment.NewLine}    Inner exception: {e.InnerException.Message}";

                    Console.WriteLine(message);
                }
                finally
                {
                    if (System.Diagnostics.Debugger.IsAttached)
                    {
                        Console.WriteLine("Press any key to exit. All documents will be closed.");
                        Console.ReadKey();
                    }
                }
            }
        }

        /// <summary>
        /// Opens box.ipt and runs samplePlugin
        /// </summary>
        /// <param name="app"></param>
        private static void DebugSamplePlugin(InventorServer app)
        {
            string projectDir = Directory.GetParent(Directory.GetCurrentDirectory()).Parent.FullName;
            string sampleDir = System.IO.Path.Combine(projectDir, "sample");
            string outputDir = System.IO.Path.Combine(projectDir, "output");

            if (System.IO.Directory.Exists(outputDir))
            {
                System.IO.Directory.Delete(outputDir, true);
            }
            CopyDirectory(sampleDir, outputDir);

            // open the template Inventor file in the copied folder
            //Document doc = app.Documents.Open(System.IO.Path.Combine(outputDir, "template.iam"));

            // create a name value map for additional parameters to the Inventor plugin
            Inventor.NameValueMap args = app.TransientObjects.CreateNameValueMap();
            // add configuration into the map, do not change "_1". You may add more parameters "_2", "_3"...
            args.Add("_1", System.IO.Path.Combine(outputDir, "config.json"));
            // add absolute path to the folder with all STEP files
            args.Add("_2", System.IO.Path.Combine(outputDir, "modules"));

            // create an instance of DesignAutomationForInventor1Plugin
            DesignAutomationForInventor1Plugin.SampleAutomation plugin = new DesignAutomationForInventor1Plugin.SampleAutomation(app);

            // run the plugin
            plugin.RunWithArguments(null, args);
        }

        private static void CopyDirectory(string srcDir, string dstDir)
        {
            if (!System.IO.Directory.Exists(dstDir))
            {
                System.IO.Directory.CreateDirectory(dstDir);
            }

            foreach (var file in System.IO.Directory.EnumerateFiles(srcDir))
            {
                System.IO.File.Copy(file, System.IO.Path.Combine(dstDir, System.IO.Path.GetFileName(file)));
            }

            foreach (var dir in System.IO.Directory.EnumerateDirectories(srcDir))
            {
                CopyDirectory(dir, System.IO.Path.Combine(dstDir, System.IO.Path.GetFileName(dir)));
            }
        }
    }
}
