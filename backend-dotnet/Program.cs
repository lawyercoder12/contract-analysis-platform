using Aspose.Words;
using Aspose.Words.Fields;
using System.IO.Compression;
using System.Xml.Linq;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);

// Load Aspose.Words license
try
{
    var license = new License();
    license.SetLicense("Aspose.Words.lic");
    Console.WriteLine("Aspose.Words license loaded successfully");
}
catch (Exception ex)
{
    Console.WriteLine($"Aspose.Words license load failed: {ex.Message}");
}

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Enable CORS for all origins (development only)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Use CORS
app.UseCors();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Helper to extract numbering from DOCX XML
string? GetNumberingLabelFromXml(Stream docxStream, int paraIndex)
{
    using (var archive = new ZipArchive(docxStream, ZipArchiveMode.Read, true))
    {
        var docEntry = archive.GetEntry("word/document.xml");
        var numEntry = archive.GetEntry("word/numbering.xml");
        if (docEntry == null || numEntry == null) return null;
        XDocument docXml, numXml;
        using (var docStream = docEntry.Open())
            docXml = XDocument.Load(docStream);
        using (var numStream = numEntry.Open())
            numXml = XDocument.Load(numStream);
        XNamespace w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        var paras = docXml.Descendants(w + "p").ToList();
        if (paraIndex >= paras.Count) return null;
        var para = paras[paraIndex];
        var numPr = para.Descendants(w + "numPr").FirstOrDefault();
        if (numPr == null) return null;
        var numIdElem = numPr.Descendants(w + "numId").FirstOrDefault();
        var ilvlElem = numPr.Descendants(w + "ilvl").FirstOrDefault();
        if (numIdElem == null || ilvlElem == null) return null;
        var numId = numIdElem.Attribute(w + "val")?.Value;
        var ilvl = ilvlElem.Attribute(w + "val")?.Value;
        if (numId == null || ilvl == null) return null;
        // Find the abstractNumId for this numId
        var numNode = numXml.Descendants(w + "num").FirstOrDefault(n => n.Element(w + "numId")?.Attribute(w + "val")?.Value == numId);
        var abstractNumId = numNode?.Element(w + "abstractNumId")?.Attribute(w + "val")?.Value;
        if (abstractNumId == null) return null;
        // Find the level node
        var absNumNode = numXml.Descendants(w + "abstractNum").FirstOrDefault(n => n.Attribute(w + "abstractNumId")?.Value == abstractNumId);
        var lvlNode = absNumNode?.Elements(w + "lvl").FirstOrDefault(l => l.Attribute(w + "ilvl")?.Value == ilvl);
        if (lvlNode == null) return null;
        // Get the numFmt and lvlText
        var numFmt = lvlNode.Element(w + "numFmt")?.Attribute(w + "val")?.Value;
        var lvlText = lvlNode.Element(w + "lvlText")?.Attribute(w + "val")?.Value;
        // For now, just return the lvlText (e.g., "%1.")
        return lvlText;
    }
}

// Helper method to detect numbering issues in list items
void DetectListNumberingIssues(Aspose.Words.Lists.ListFormat listFormat, string numLabel, int? level, 
    string paragraphId, Dictionary<string, Dictionary<string, int>> listTracking, 
    List<object> numberingDiscrepancies, bool hasNumberingFields, string documentId)
{
    if (!level.HasValue || listFormat?.List == null) return;
    var numId = listFormat.List.ListId.ToString();
    var currentLevel = level.Value;
    // Use the full numLabel (e.g., 2, 2.1, 2.2) as the key for tracking
    var labelKey = numLabel.Trim();
    if (string.IsNullOrWhiteSpace(labelKey)) return;
    // Initialize tracking for this list if needed
    if (!listTracking.ContainsKey(numId))
    {
        listTracking[numId] = new Dictionary<string, int>();
    }
    var labelTracking = listTracking[numId];
    // Extract the last numeric part for sequence checking
    var parts = labelKey.Split('.');
    var lastPart = parts.LastOrDefault();
    if (int.TryParse(lastPart, out int currentNumber))
    {
        // Build the parent label (e.g., for 2.2, parent is 2)
        string parentLabel = string.Join(".", parts.Take(parts.Length - 1));
        // Only check for duplicates at the same full label
        if (labelTracking.ContainsKey(labelKey))
        {
            var lastNumber = labelTracking[labelKey];
            if (currentNumber == lastNumber)
            {
                numberingDiscrepancies.Add(new {
                    type = "duplicate",
                    paragraphId = paragraphId,
                    documentId = documentId,
                    details = $"Duplicate number {labelKey}"
                });
            }
            else if (currentNumber < lastNumber)
            {
                numberingDiscrepancies.Add(new {
                    type = "outoforder",
                    paragraphId = paragraphId,
                    documentId = documentId,
                    details = $"Number sequence decreased from {lastNumber} to {currentNumber} at {labelKey}"
                });
            }
            else if (currentNumber > lastNumber + 1)
            {
                numberingDiscrepancies.Add(new {
                    type = "skipped",
                    paragraphId = paragraphId,
                    documentId = documentId,
                    details = $"Skipped number(s) between {lastNumber} and {currentNumber} at {labelKey}"
                });
            }
        }
        labelTracking[labelKey] = currentNumber;
    }
    // Check for format inconsistencies by comparing with XML
    if (string.IsNullOrEmpty(numLabel) || numLabel == ".")
    {
        numberingDiscrepancies.Add(new {
            type = "inconsistent",
            paragraphId = paragraphId,
            documentId = documentId,
            details = $"Inconsistent or missing numbering format at label {labelKey}"
        });
    }
}

app.MapPost("/parse-docx", async (HttpRequest request) =>
{
    if (!request.HasFormContentType)
        return Results.BadRequest("Content-Type must be multipart/form-data");

    var form = await request.ReadFormAsync();
    var file = form.Files["file"];
    if (file == null || file.Length == 0)
        return Results.BadRequest("No file uploaded");
    
    var documentId = form["documentId"].ToString();
    if (string.IsNullOrEmpty(documentId))
        documentId = "doc-1"; // fallback for backwards compatibility

    try
    {
        using var stream = file.OpenReadStream();
        var doc = new Aspose.Words.Document(stream);
        doc.UpdateListLabels();
        var paragraphs = new List<object>();
        var numberingDiscrepancies = new List<object>();
        int paraId = 1;
        int maxLevel = 0;
        
        // Rewind stream for XML fallback
        stream.Position = 0;
        var docxBytes = new MemoryStream();
        stream.CopyTo(docxBytes);
        docxBytes.Position = 0;
        
        // Track numbering state for discrepancy detection
        var listTracking = new Dictionary<string, Dictionary<string, int>>(); // numId -> labelKey -> lastNumber
        // Track the most recent number label at each level for misnumbered subclause detection
        var lastLabelAtLevel = new Dictionary<int, string>();
        var manualNumberingRegex = new Regex(@"^\s*[\(\[]?\d+[\)\.]|^\s*[\(\[]?[a-zA-Z][\)\.]|^\s*[\(\[]?[ivxlcdm]+[\)\.]|^\s*[\(\[]?[IVXLCDM]+[\)\.]|^\s*\u2022|^\s*\-|^\s*\*", RegexOptions.IgnoreCase);

        int previousLevel = -1;
        
        // Extract paragraphs, numbering, indentation
        foreach (Aspose.Words.Paragraph para in doc.GetChildNodes(Aspose.Words.NodeType.Paragraph, true))
        {
            var paraProps = para.ParagraphFormat;
            string numLabel = "";
            int? level = null;
            bool isListItem = para.IsListItem;
            var listLabel = para.ListLabel;
            var listFormat = para.ListFormat;
            var paragraphId = $"para-{paraId}";
            var text = new string(para.GetText().Where(c => !char.IsControl(c) || c == '\n' || c == '\r').ToArray()).Trim();
            
            // Check for field codes (SEQ, LISTNUM)
            bool hasNumberingFields = para.Range.Fields.Any(f => 
                f.Type == FieldType.FieldSequence || f.Type == FieldType.FieldListNum);
            
            if (isListItem)
            {
                numLabel = listLabel?.LabelString ?? "";
                if (string.IsNullOrEmpty(numLabel) || numLabel == ".")
                {
                    // Fallback to XML-based extraction
                    numLabel = GetNumberingLabelFromXml(docxBytes, paraId - 1) ?? "";
                }
                level = listFormat?.ListLevelNumber;

                int currentLevel = level ?? -1;
                if (currentLevel < previousLevel)
                {
                    var keysToRemove = lastLabelAtLevel.Keys.Where(k => k > currentLevel).ToList();
                    foreach (var key in keysToRemove)
                    {
                        lastLabelAtLevel.Remove(key);
                    }
                }
                if (level.HasValue && level.Value > maxLevel)
                {
                    maxLevel = level.Value;
                }
                // Misnumbered subclause detection
                if (level.HasValue && level.Value > 0)
                {
                    var parentLevel = level.Value - 1;
                    if (lastLabelAtLevel.ContainsKey(parentLevel))
                    {
                        var parentLabel = lastLabelAtLevel[parentLevel];
                        // Remove trailing dot for comparison
                        var parentLabelClean = parentLabel.TrimEnd('.');
                        var numLabelClean = numLabel.TrimEnd('.');
                        if (!numLabelClean.StartsWith(parentLabelClean + "."))
                        {
                            numberingDiscrepancies.Add(new {
                                type = "misnumbered_subclause",
                                paragraphId = paragraphId,
                                documentId = documentId,
                                details = $"Subclause '{numLabel}' does not match expected parent numbering '{parentLabel}.'"
                            });
                        }
                    }
                }
                // Update lastLabelAtLevel for this level
                if (level.HasValue)
                {
                    lastLabelAtLevel[level.Value] = numLabel;
                }
                
                // Detect numbering discrepancies for list items
                if (listFormat != null)
                {
                    DetectListNumberingIssues(listFormat, numLabel, level, paragraphId, listTracking, numberingDiscrepancies, hasNumberingFields, documentId);
                }
            }
            else
            {
                int currentLevel = -1;
                if (currentLevel < previousLevel)
                {
                    var keysToRemove = lastLabelAtLevel.Keys.Where(k => k > currentLevel).ToList();
                    foreach (var key in keysToRemove)
                    {
                        lastLabelAtLevel.Remove(key);
                    }
                }

                // Check for manual numbering (text looks numbered but not a list item)
                if (!string.IsNullOrWhiteSpace(text) && manualNumberingRegex.IsMatch(text))
                {
                    numberingDiscrepancies.Add(new {
                        type = "manual",
                        paragraphId = paragraphId,
                        documentId = documentId,
                        details = $"Paragraph appears manually numbered but not using list formatting: '{text.Substring(0, Math.Min(50, text.Length))}...'"
                    });
                }
            }
            
            // Check for mixed numbering methods
            if (hasNumberingFields && isListItem)
            {
                numberingDiscrepancies.Add(new {
                    type = "mixed",
                    paragraphId = paragraphId,
                    documentId = documentId,
                    details = "Paragraph uses both list formatting and field codes (SEQ/LISTNUM)"
                });
            }
            
            string leftRem = paraProps.LeftIndent > 0 ? $"{paraProps.LeftIndent / 12.0}rem" : "0";
            string hangingRem = paraProps.FirstLineIndent < 0 ? $"{Math.Abs(paraProps.FirstLineIndent) / 12.0}rem" : "0";
            var indent = new { left = leftRem, hanging = hangingRem };
            
            paragraphs.Add(new {
                id = paragraphId,
                text,
                clause = "",
                numLabel = numLabel,
                level = level,
                documentId = documentId,
                indent = indent
            });

            previousLevel = level ?? -1;
            paraId++;
        }
        return Results.Ok(new { paragraphs, numberingDiscrepancies, maxLevel });
    }
    catch (Exception ex)
    {
        return Results.BadRequest($"Error parsing document: {ex.Message}");
    }
});

app.Run();
