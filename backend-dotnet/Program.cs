using Aspose.Words;
using System.IO.Compression;
using System.Xml.Linq;

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

app.MapPost("/parse-docx", async (HttpRequest request) =>
{
    if (!request.HasFormContentType)
        return Results.BadRequest("Content-Type must be multipart/form-data");

    var form = await request.ReadFormAsync();
    var file = form.Files["file"];
    if (file == null || file.Length == 0)
        return Results.BadRequest("No file uploaded");

    try
    {
        using var stream = file.OpenReadStream();
        var doc = new Aspose.Words.Document(stream);
        doc.UpdateListLabels();
        var paragraphs = new List<object>();
        int paraId = 1;
        // Rewind stream for XML fallback
        stream.Position = 0;
        var docxBytes = new MemoryStream();
        stream.CopyTo(docxBytes);
        docxBytes.Position = 0;
        // Extract paragraphs, numbering, indentation
        foreach (Aspose.Words.Paragraph para in doc.GetChildNodes(Aspose.Words.NodeType.Paragraph, true))
        {
            var paraProps = para.ParagraphFormat;
            string numLabel = "";
            int? level = null;
            bool isListItem = para.IsListItem;
            var listLabel = para.ListLabel;
            var listFormat = para.ListFormat;
            if (isListItem)
            {
                numLabel = listLabel?.LabelString ?? "";
                if (string.IsNullOrEmpty(numLabel) || numLabel == ".")
                {
                    // Fallback to XML-based extraction
                    numLabel = GetNumberingLabelFromXml(docxBytes, paraId - 1) ?? "";
                }
                level = listFormat?.ListLevelNumber;
            }
            string leftRem = paraProps.LeftIndent > 0 ? $"{paraProps.LeftIndent / 12.0}rem" : "0";
            string hangingRem = paraProps.FirstLineIndent < 0 ? $"{Math.Abs(paraProps.FirstLineIndent) / 12.0}rem" : "0";
            var indent = new { left = leftRem, hanging = hangingRem };
            var text = new string(para.GetText().Where(c => !char.IsControl(c) || c == '\n' || c == '\r').ToArray()).Trim();
            paragraphs.Add(new {
                id = $"para-{paraId}",
                text,
                clause = "",
                numLabel = numLabel,
                level = level,
                documentId = "doc-1",
                indent = indent
            });
            paraId++;
        }
        return Results.Ok(new { paragraphs });
    }
    catch (Exception ex)
    {
        return Results.BadRequest($"Error parsing document: {ex.Message}");
    }
});

app.Run();
