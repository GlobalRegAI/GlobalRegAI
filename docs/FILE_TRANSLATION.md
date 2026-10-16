# File attachment and translation — release 17

The homepage's + button accepts multiple files (up to eight) and drag/drop. The file picker intentionally does not filter extensions. Supported content readers: PDF with text, DOC (Word 97–2003 body), DOCX, XLS/XLSX/XLSM, CSV/TSV, HWP v5/HWPX, PPTX, ODT/ODS, RTF, TXT/MD, HTML, JSON/XML/YAML/LOG and ZIP members. Unsupported binary formats return a per-file error; attaching a file does not mean every format can be decoded.

Limits: 4 MB per upload, 30 members per ZIP, 24 MB expanded archive, 160,000 extracted characters per document/archive/translation run, 150 PDF pages, and bounded spreadsheet dimensions. Nested archives, unsafe paths, encrypted files and decompression bombs are rejected. Archives are read in memory and never extracted to disk. Framework temporary upload spools live only for the request and are closed after reading; no permanent file/document store is used.

HWP reads BodyText section records, not the truncated PrvText preview. DOC uses the Word piece table. DOCX includes body paragraphs/tables and header/footer/footnote/endnote parts. Each reader reports scope exclusions; images, scanned PDFs, layout recreation, macros, embedded objects and OCR are not supported. Source names and extracted content are always rendered as text, never HTML.

After consent, extracted text is translated in bounded sequential segments using the existing server-side Groq configuration. No browser API key is exposed. Pause/resume retains completed segments in the current page, and retries do not retranslate accepted segments. Refresh/navigation clears the in-memory work. Partial files and failures are shown explicitly. Numeric-token preservation and provider finish status are checked; this does not prove semantic or terminological accuracy.

Technical terms use an English base term plus an established local equivalent where available; acronyms and unclear terms must not be guessed. The evolving glossary is passed between segments. Source text is untrusted data, never system instructions. Terminology and translated content remain AI drafts, not official/certified translations.

Exports: bilingual plain text, DOCX or XLSX with source locations and terminology. Original layout is not retained. Partial export status and known extraction errors are retained in Office export notes. XLSX cell values are explicitly strings to prevent formula injection.

APIs: POST /api/files/extract (multipart), /api/files/translate (one bounded segment), /api/files/export (DOCX/XLSX). Existing DeepL endpoints remain separate for backward compatibility. The homepage's new file translation works with the already configured Groq provider.

Validation: Python reader/API/export/provider tests plus DOM integration tests for attach-only submission, consent, partial failure, continuation, escaping and reset. HWP was also exercised against pyhwp's public charshape, table-position, sample-5017-pics and password fixtures. DOC was checked against Apache POI's simple.doc. Fixture documents are not included in the repository. This is not an iPhone device/layout test.

Format references: Hancom HWP v5 record specification and HWPX structure, Microsoft MS-DOC PlcPcd/Pcd/FcCompressed/FibRgFcLcb97. Vercel Functions' 4.5 MB payload cap motivates the 4 MB file limit.
