using System.Collections.Generic;
using Autodesk.Forge.DesignAutomation.Model;

namespace Interaction
{
    /// <summary>
    /// Customizable part of Publisher class.
    /// </summary>
    internal partial class Publisher
    {
        /// <summary>
        /// Constants.
        /// </summary>
        private static class Constants
        {
            private const int EngineVersion = 2022;
            public static readonly string Engine = $"Autodesk.Inventor+{EngineVersion}";

            public const string Description = "PUT DESCRIPTION HERE";

            internal static class Bundle
            {
                public static readonly string Id = "InventorAssembler";
                public const string Label = "alpha";

                public static readonly AppBundle Definition = new AppBundle
                {
                    Engine = Engine,
                    Id = Id,
                    Description = Description
                };
            }

            internal static class Activity
            {
                public static readonly string Id = Bundle.Id;
                public const string Label = Bundle.Label;
            }

            internal static class Parameters
            {
                public const string configJson = nameof(configJson);
                public const string templateArchive = nameof(templateArchive);
            }
        }


        /// <summary>
        /// Get command line for activity.
        /// </summary>
        private static List<string> GetActivityCommandLine()
        {
            return new List<string> { $"$(engine.path)\\InventorCoreConsole.exe /al \"$(appbundles[{Constants.Bundle.Id}].path)\" \"$(args[{Constants.Parameters.configJson}].path)\" \"$(args[{Constants.Parameters.templateArchive}].path)\"" };
        }

        /// <summary>
        /// Get activity parameters.
        /// </summary>
        private static Dictionary<string, Parameter> GetActivityParams()
        {
            return new Dictionary<string, Parameter>
                    {
                        {
                            Constants.Parameters.configJson,
                            new Parameter
                            {
                                Verb = Verb.Get,
                                Description = "Json config file",
                                Required = true
                            }
                        },
                        {
                            Constants.Parameters.templateArchive,
                            new Parameter
                            {
                                Verb = Verb.Get,
                                Zip = true,
                                Description = "Zipped part files",
                                Required = true
                            }
                        }
                    };
        }

        /// <summary>
        /// Get arguments for workitem.
        /// </summary>
        private static Dictionary<string, IArgument> GetWorkItemArgs()
        {
            // TODO: update the URLs below with real values
            return new Dictionary<string, IArgument>
            {
                {
                    Constants.Parameters.configJson,
                    new XrefTreeArgument()
                    {
                        Url = "https://developer.api.autodesk.com/oss/v2/signedresources/e64a58e8-b563-41b4-bb98-460039881656?region=US",
                        LocalName = "config.json"
                    }
                },
                {
                    Constants.Parameters.templateArchive,
                    new XrefTreeArgument()
                    {
                        Url = "https://developer.api.autodesk.com/oss/v2/signedresources/9f5c9442-a7a2-42f2-86da-dc141e2165bd?region=US",
                        LocalName = "template"
                    }
                }
            };
        }
    }
}
