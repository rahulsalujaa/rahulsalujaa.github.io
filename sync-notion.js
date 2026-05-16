const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const POSTS_DIR = path.join(__dirname, "content", "posts");

async function syncPosts() {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: "Published",
      checkbox: { equals: true },
    },
    sorts: [{ property: "Date", direction: "descending" }],
  });

  if (fs.existsSync(POSTS_DIR)) {
    fs.rmSync(POSTS_DIR, { recursive: true });
  }
  fs.mkdirSync(POSTS_DIR, { recursive: true });

  for (const page of response.results) {
    const title = page.properties.Title.title[0]?.plain_text || "Untitled";
    const slug = page.properties.Slug?.rich_text[0]?.plain_text || title.toLowerCase().replace(/\s+/g, "-");
    const date = page.properties.Date?.date?.start || new Date().toISOString().split("T")[0];
    const tags = page.properties.Tags?.multi_select?.map(t => t.name) || [];

    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdBlocks).parent;

    const content = "---\ntitle: \"" + title + "\"\ndate: " + date + "\ntags: [" + tags.map(t => "\"" + t + "\"").join(", ") + "]\ndraft: false\n---\n\n" + mdString;

    fs.writeFileSync(path.join(POSTS_DIR, slug + ".md"), content);
    console.log("Synced: " + title);
  }
  console.log("Done! Synced " + response.results.length + " posts.");
}

syncPosts().catch(console.error);
