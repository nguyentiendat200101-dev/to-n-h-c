export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const allowedOrigin = "https://nguyentiendat200101-dev.github.io";
  if (req.headers.origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Chỉ hỗ trợ gửi câu hỏi bằng POST." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Máy chủ chưa cấu hình OPENAI_API_KEY." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const grade = Math.max(1, Math.min(12, Number.parseInt(body.grade, 10) || 6));
    const message = String(body.message || "").trim();
    if (!message) return res.status(400).json({ error: "Bạn hãy nhập câu hỏi." });
    if (message.length > 8000) return res.status(413).json({ error: "Câu hỏi quá dài. Hãy chia thành các phần ngắn hơn." });

    const instructions = [
      "Bạn là Gia sư Toán học bằng tiếng Việt cho học sinh Việt Nam lớp 1 đến lớp 12.",
      "Hỗ trợ mọi chủ đề toán học phù hợp: số học, đại số, hình học phẳng và không gian, đo lường, hàm số, lượng giác, giải tích, thống kê, xác suất, số phức, chứng minh, bài toán thực tế và các câu hỏi toán liên quan.",
      "Trình bày lời giải đúng, rõ ràng và phù hợp trình độ lớp " + grade + ". Với bài tập, giải từng bước, nêu công thức/quy tắc, thay số hoặc biến đổi, rồi kiểm tra đáp án khi phù hợp.",
      "Nếu đề thiếu dữ kiện, ký hiệu không rõ hoặc có nhiều cách hiểu, hãy hỏi lại hoặc nêu giả định rõ ràng; không bịa dữ kiện. Nếu không chắc chắn, hãy nói rõ và kiểm tra lập luận thay vì đoán.",
      "Khi học sinh hỏi tiếp, hãy dùng ngữ cảnh cuộc trò chuyện được cung cấp để giải thích lại theo cách khác, chậm hơn hoặc đưa ví dụ tương tự. Khuyến khích học hiểu, không chỉ đưa đáp án.",
      "Trả lời bằng tiếng Việt trừ khi học sinh yêu cầu ngôn ngữ khác. Dùng định dạng văn bản dễ đọc; không dùng HTML. An toàn, thân thiện, tôn trọng học sinh."
    ].join("\n");

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions,
        input: message,
        max_output_tokens: 1800
      })
    });

    const result = await upstream.json();
    if (!upstream.ok) {
      console.error("OpenAI API error", upstream.status, result && result.error ? result.error.message : "Unknown error");
      return res.status(502).json({ error: "Gia sư AI gặp lỗi khi xử lý câu hỏi. Vui lòng thử lại sau." });
    }

    const answer = (result.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n")
      .trim();

    if (!answer) return res.status(502).json({ error: "Gia sư chưa tạo được câu trả lời. Bạn hãy thử hỏi lại." });
    return res.status(200).json({ answer });
  } catch (error) {
    console.error("Tutor endpoint error", error);
    return res.status(500).json({ error: "Đã xảy ra lỗi máy chủ. Vui lòng thử lại." });
  }
}
