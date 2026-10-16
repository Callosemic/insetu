## Research Inbox: AI Batch Triage Instructions

Review the attached scraped research documents. Filter out any documents that are SEO spam, irrelevant to the research objective, or low quality.

Output your response as a raw JSON object containing three arrays of `id` strings:
* `accept`: Highly relevant, substantive documents to import into the workspace.
* `reject`: Spam, off-topic, or low-value pages to discard.
* `rescan`: Relevant pages that appear truncated, garbled, or poorly extracted and should be re-scraped.

Do not include conversational filler outside the JSON object. Example format:

```json
{
  "accept": ["id-1", "id-2"],
  "reject": ["id-3"],
  "rescan": ["id-4"]
}
```