import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

function json(res, status, body) {
  return res.status(status).json(body);
}

const allowed = (value, list, fallback) =>
  list.includes(value) ? value : fallback;

function parseJSON(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  throw new Error("AI response JSON parse failed.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return json(res, 500, {
      error:
        "OPENAI_API_KEY missing. Vercel → Settings → Environment Variables में key जोड़ें और फिर Redeploy करें.",
      code: "MISSING_API_KEY",
    });
  }

  const client = new OpenAI({ apiKey });

  try {
    const b = req.body || {};

    const mode = allowed(
      b.mode,
      ["post", "reel", "story", "bio"],
      "post"
    );

    const language = allowed(
      b.language,
      ["hinglish", "hindi", "english", "punjabi", "bengali"],
      "hinglish"
    );

    const style = allowed(
      b.style,
      [
        "cool",
        "funny",
        "attitude",
        "love",
        "motivational",
        "aesthetic",
        "professional",
        "luxury",
        "travel",
      ],
      "cool"
    );

    const length = allowed(
      b.length,
      ["short", "medium", "long"],
      "medium"
    );

    const count = Math.min(
      10,
      Math.max(1, Number(b.count) || 5)
    );

    const topic = String(b.topic || "")
      .trim()
      .slice(0, 140);

    const image =
      typeof b.image === "string" ? b.image : null;

    if (!topic && !image) {
      return json(res, 400, {
        error: "Topic या photo में से कम-से-कम एक देना जरूरी है.",
        code: "MISSING_INPUT",
      });
    }

    if (image) {
      const validImage =
        /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image);

      if (!validImage || image.length > 2000000) {
        return json(res, 400, {
          error:
            "Image बड़ी है या format unsupported है. JPG, PNG या WebP की छोटी image इस्तेमाल करें.",
          code: "INVALID_IMAGE",
        });
      }
    }

    const lang = {
      hinglish: "natural Hinglish",
      hindi: "natural Hindi",
      english: "natural English",
      punjabi: "Punjabi-style",
      bengali: "Bengali-style",
    }[language];

    const len = {
      short: "1 short punchy sentence",
      medium: "1–3 natural sentences",
      long: "3–5 engaging sentences",
    }[length];

    const prompt = `
Create ${count} distinct Instagram captions.

Content type: ${mode}
Language: ${lang}
Style: ${style}
Length: ${len}
Emojis: ${
      b.emojis
        ? "include tasteful emojis"
        : "do not use emojis"
    }
Hashtags: ${
      b.hashtags
        ? "create 6–10 relevant hashtags"
        : "do not create hashtags"
    }
${
  b.hooks && mode === "reel"
    ? "Create 5 short scroll-stopping Reel hooks."
    : "Return an empty hooks array."
}

Rules:
- Do not invent facts not visible or supplied by the user.
- Do not mention that you are AI.
- Avoid generic repetition.
- Keep captions natural for Instagram.
- Return ONLY JSON matching the requested schema.

User topic: ${
      topic || "(none; infer only clearly visible image details)"
    }
`;

    const content = [
      {
        type: "input_text",
        text: prompt,
      },
    ];

    if (image) {
      content.push({
        type: "input_image",
        image_url: image,
        detail: "auto",
      });
    }

    const response = await client.responses.create({
      model: MODEL,
      input: [
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "instagram_caption_result",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              captions: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              hooks: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              hashtags: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
            required: [
              "captions",
              "hooks",
              "hashtags",
            ],
          },
        },
      },
    });

    const parsed = parseJSON(response.output_text);

    const captions = Array.isArray(parsed.captions)
      ? parsed.captions
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, count)
      : [];

    const hooks = Array.isArray(parsed.hooks)
      ? parsed.hooks
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];

    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];

    if (!captions.length) {
      throw new Error(
        "AI ने कोई caption return नहीं किया."
      );
    }

    return json(res, 200, {
      results: {
        captions,
        hooks,
        hashtags,
      },
      model: MODEL,
    });
  } catch (e) {
    console.error("AI generation error:", e);

    const status = Number(e?.status) || 500;

    let message =
      e?.message || "AI generation failed.";

    let code = "AI_ERROR";

    if (status === 401) {
      message =
        "OpenAI API key invalid/expired है. OPENAI_API_KEY check करें.";
      code = "INVALID_API_KEY";
    } else if (status === 403) {
      message =
        "OpenAI API access denied है. API project/billing/model access check करें.";
      code = "API_ACCESS_DENIED";
    } else if (status === 404) {
      message = `OpenAI model '${MODEL}' उपलब्ध नहीं है. Vercel में OPENAI_MODEL को अपने account के supported model पर सेट करें.`;
      code = "MODEL_NOT_FOUND";
    } else if (status === 429) {
      message =
        "OpenAI API quota/rate limit reached है. Billing और usage check करें.";
      code = "RATE_LIMITED";
    }

    return json(
      res,
      status >= 400 && status < 600
        ? status
        : 500,
      {
        error: message,
        code,
      }
    );
  }
  }
