/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

using Inventor;
using System.Threading;
using Newtonsoft.Json;
using System.IO.Compression;
using System.Collections.Generic;

namespace DesignAutomationForInventor1Plugin
{
    [ComVisible(true)]
    public class SampleAutomation
    {
        public class ConfigEntry
        {
            [JsonProperty("path")]
            public string Path { get; set; }

            [JsonProperty("xform")]
            public double [] Xform { get; set; }
        }

        InventorServer inventorApplication;

        public SampleAutomation(InventorServer inventorApp)
        {
            inventorApplication = inventorApp;
        }

        public void Run(Document doc)
        {
            LogTrace("Run called with {0}", doc.DisplayName);
        }

        private class HeartBeat : IDisposable
        {
            // default is 50s
            public HeartBeat(int intervalMillisec = 50000)
            {
                t = new Thread(() =>
                {

                    LogTrace("HeartBeating every {0}ms.", intervalMillisec);

                    for (;;)
                    {
                        Thread.Sleep((int)intervalMillisec);
                        LogTrace("HeartBeat {0}.", (long)(new TimeSpan(DateTime.Now.Ticks - ticks).TotalSeconds));
                    }

                });

                ticks = DateTime.Now.Ticks;
                t.Start();
            }

            public void Dispose()
            {
                Dispose(true);
                GC.SuppressFinalize(this);
            }

            protected virtual void Dispose(bool disposing)
            {
                if (disposing)
                {
                    if (t != null)
                    {
                        LogTrace("Ending HeartBeat");
                        t.Abort();
                        t = null;
                    }
                }
            }

            private Thread t;
            private long ticks;
        }

        public bool IsInventorDocument(string fileName)
        {
            string lower = fileName.ToLower();

            return (lower.EndsWith(".iam") || lower.EndsWith(".ipt")); 
        }

        public bool IsAssemblyDocument(string fileName)
        {
            string lower = fileName.ToLower();

            return lower.EndsWith(".iam");
        }

        BIMComponent getBIMComponent(Document doc)
        {
            BIMComponent bimComponent = null;
            var docType = doc.DocumentType;
            if (docType == DocumentTypeEnum.kAssemblyDocumentObject)
            {
                AssemblyDocument _doc = doc as AssemblyDocument;
                bimComponent = _doc.ComponentDefinition.BIMComponent;
            }
            else if (docType == DocumentTypeEnum.kPartDocumentObject)
            {
                PartDocument _doc = doc as PartDocument;
                bimComponent = _doc.ComponentDefinition.BIMComponent;
            }
            else
            {
                Trace.TraceInformation("NOT supported document type.");
            }

            return bimComponent;
        }

        public void ExportRFA(Document doc, string filePath)
        {
            LogTrace("Exporting RFA file.");

            BIMComponent bimComponent = getBIMComponent(doc);
            if (bimComponent == null)
            {
                LogTrace("Could not export RFA file.");
                return;
            }

            NameValueMap nvm = inventorApplication.TransientObjects.CreateNameValueMap();
            string currentDir = System.IO.Directory.GetCurrentDirectory();
            var reportFileName = System.IO.Path.Combine(currentDir, "Report.html");
            nvm.Add("ReportFileName", reportFileName);
            bimComponent.ExportBuildingComponentWithOptions(filePath, nvm);

            LogTrace("Exported RFA file.");
        }

        public void RunWithArguments(Document doc, NameValueMap map)
        {
            // map["_1"] contains absolute path to configuration json
            // map["_2"] contains absolute path to folder with module STEP (or other types of) files
            // map["_3"] (optional) contains relative path to assembly to open

            /* Sample json structure
               [
                 {  "path": "some\\path\\to\\enclosure.iam",
                    "xform": [
                        1, 0, 0, 10,
                        0, 1, 0,  0,
                        0, 0, 1,  0,
                        0, 0, 0,  1
                    ] 
                 },
                 {  "path": "some\\path\\to\\part.ipt",
                    "xform": [
                        1, 0, 0, 10,
                        0, 1, 0, 20,
                        0, 0, 1, 30,
                        0, 0, 0,  1
                    ] 
                  }
               ] 
            */

            try
            {
                using (new HeartBeat(30000))
                {
                    string currentDir = System.IO.Directory.GetCurrentDirectory();

                    LogTrace("Parsing configuration");
                    string json = System.IO.File.ReadAllText((string)map.Value["_1"]);
                    List<ConfigEntry> config = JsonConvert.DeserializeObject<List<ConfigEntry>>(json);

                    string modulesDir = (string)map.Value["_2"];

                    LogTrace("Assembling modules");
                    doc = inventorApplication.Documents.Add(DocumentTypeEnum.kAssemblyDocumentObject, "", false);
                    AssemblyDocument asmDoc = doc as AssemblyDocument;

                    // Add Design View representation in case we need it
                    DesignViewRepresentation dvr = asmDoc.ComponentDefinition.RepresentationsManager.DesignViewRepresentations.Add("Default");
                    dvr.Activate(); 

                    AssemblyComponentDefinition compDef = asmDoc.ComponentDefinition;
                    TransientGeometry geom = inventorApplication.TransientGeometry;
                    Matrix matrix;

                    var moduleOccurrences = new Dictionary<string, ComponentOccurrence>();
                    foreach (var entry in config)
                    {
                        LogTrace("Module {0} ({1})", entry.Path, String.Join(", ", entry.Xform));
                        try
                        {
                            matrix = geom.CreateMatrix();
                            matrix.PutMatrixData(entry.Xform);

                            ComponentOccurrence compOcc = null;
                            if (moduleOccurrences.ContainsKey(entry.Path))
                            {
                                compOcc = compDef.Occurrences.AddByComponentDefinition(moduleOccurrences[entry.Path].Definition, matrix);
                            }
                            else
                            {
                                var modulePath = System.IO.Path.Combine(modulesDir, entry.Path);

                                if (IsInventorDocument(modulePath))
                                {
                                    string dvRep = null;
                                    string lodRep = null;
                                    if (IsAssemblyDocument(modulePath))
                                    {
                                        dvRep = inventorApplication.FileManager.GetLastActiveDesignViewRepresentation(modulePath);
                                        lodRep = inventorApplication.FileManager.GetLastActiveLevelOfDetailRepresentation(modulePath);
                                    }
                                    
                                    compOcc = compDef.Occurrences.Add(modulePath, matrix);

                                    if (dvRep != null)
                                    {
                                        compOcc.SetDesignViewRepresentation(dvRep);
                                    }

                                    if (lodRep != null)
                                    {
                                        compOcc.SetLevelOfDetailRepresentation(lodRep);
                                    }
                                }
                                else
                                {
                                    // Create the ImportedGenericComponentDefinition bases on an Alias file
                                    dynamic oImportedGenericCompDef = compDef.ImportedComponents.CreateDefinition(modulePath);

                                    // Set the ReferenceModel to associatively import the Alias file
                                    oImportedGenericCompDef.ReferenceModel = true;

                                    // Import the Solidworks to assembly
                                    var oImportedComp = compDef.ImportedComponents.Add(oImportedGenericCompDef);

                                    compOcc = compDef.Occurrences[compDef.Occurrences.Count];
                                    compOcc.Transformation = matrix;
                                }

                                moduleOccurrences.Add(entry.Path, compOcc);
                            }

                            // Debugging
                            var occurrencePath = compOcc.Definition.Document.FullFileName;
                            LogTrace("Path of added occurrence: {0}", occurrencePath);
                        }
                        catch (Exception e)
                        {
                            LogTrace("Cannot add file {0}: {1}", entry.Path, e.Message);
                        }
                    }

                    LogTrace("Finishing assembly");
                    doc.Update();

                    LogTrace("Saving assembly");
                    var assemblyPath = System.IO.Path.Combine(modulesDir, "template.iam");
                    doc.SaveAs(assemblyPath, false);
                    var rfaPath = System.IO.Path.Combine(currentDir, "output.rfa");
                    ExportRFA(doc, rfaPath);

                    /*
                    LogTrace("Copying referenced documents to working folder");
                    foreach(dynamic rf in doc.File.AllReferencedFiles)
                    {
                        var oldPath = rf.FullFileName;
                        var docName = System.IO.Path.GetFileName(oldPath);
                        var newPath = System.IO.Path.Combine(documentDir, docName);
                        System.IO.File.Copy(oldPath, newPath, true);
                    }
                    */

                    LogTrace("Compressing output");
                    using (var archive = ZipFile.Open("output.zip", ZipArchiveMode.Create))
                    {
                        archive.CreateEntryFromFile(assemblyPath, System.IO.Path.GetFileName(assemblyPath));

                        foreach (dynamic rf in doc.File.AllReferencedFiles)
                        {
                            string fileName = rf.FullFileName;
                            archive.CreateEntryFromFile(fileName, System.IO.Path.GetFileName(fileName));
                        }
                    }

                    LogTrace("Closing assembly");
                    doc.Close(true);

                    /*
                    LogTrace("Compressing output");
                    using (var archive = ZipFile.Open(System.IO.Path.Combine(documentDir, "output.zip"), ZipArchiveMode.Create))
                    {
                        foreach (var entry in System.IO.Directory.EnumerateFiles(documentDir))
                        {
                            if (entry.EndsWith(".ipt") || entry.EndsWith(".iam"))
                            {
                                archive.CreateEntryFromFile(entry, System.IO.Path.GetFileName(entry));
                            }
                        }
                    }
                    */
                }
            }
            catch (Exception e)
            {
                LogError("Processing failed. " + e.ToString());
            }
        }

        #region Logging utilities

        /// <summary>
        /// Log message with 'trace' log level.
        /// </summary>
        private static void LogTrace(string format, params object[] args)
        {
            Trace.TraceInformation(format, args);
        }

        /// <summary>
        /// Log message with 'trace' log level.
        /// </summary>
        private static void LogTrace(string message)
        {
            Trace.TraceInformation(message);
        }

        /// <summary>
        /// Log message with 'error' log level.
        /// </summary>
        private static void LogError(string format, params object[] args)
        {
            Trace.TraceError(format, args);
        }

        /// <summary>
        /// Log message with 'error' log level.
        /// </summary>
        private static void LogError(string message)
        {
            Trace.TraceError(message);
        }

        #endregion
    }
}