# SEO kỹ thuật — v0.7.6

Không thêm section, đoạn văn, liên kết ẩn, từ khóa hay FAQ phục vụ tìm kiếm vào nội dung hiển thị. Tiêu đề bài, lời dẫn và nguyên văn MDX được giữ nguyên. Không có script SEO chạy phía trình duyệt.

## Hệ thống

- `editorial/essay-seo.json`: mô tả riêng cho từng bài, giả thuyết truy vấn trọng tâm nội bộ, dấu kiểm nội dung đã rà soát và ngày sửa metadata.
- `src/lib/seo/publication.mjs`: một nơi tạo URL chuẩn, Article / WebPage / Person / WebSite / Organization và ngày cập nhật sitemap.
- Ảnh metadata dùng ảnh tự host lớn nhất đã có trong pipeline; không tải thêm ảnh trên trang đọc.
- Canonical, Open Graph, schema và URL trong JSON Feed nhất quán. ID cũ trong feed được giữ để tránh gửi lại bài cũ.
- Phần chia sẻ và sidebar được đánh dấu `data-nosnippet` để hạn chế trích các lời mời thao tác làm đoạn mô tả tìm kiếm. Không chặn đọc hay lập chỉ mục nguyên văn bài.
- PDF là bản tải xuống, có `X-Robots-Tag: noindex, noarchive`, không nằm trong sitemap. Không chặn crawl đường dẫn PDF trong robots.txt để máy tìm kiếm đọc được header này.

`focusQuery` chỉ là giả thuyết biên tập để theo dõi, chưa phải kết quả nghiên cứu lượng tìm kiếm. Trường này không được đưa vào HTML, meta keywords hay schema. Không có lời hứa tăng hạng bằng metadata: Google có thể tự viết lại snippet và chọn canonical khác.

## Đăng hoặc sửa bài

1. Viết bài theo quy trình biên tập hiện có.
2. Chạy `npm run seo:review`. Bài mới hoặc bài đã sửa sẽ hiện ID và SHA-256 nguồn cần rà lại.
3. Thêm/cập nhật record trong `editorial/essay-seo.json`: viết `description` trung thực, riêng cho bài, cùng ngôn ngữ với bài; khoảng 1–2 câu. Giới hạn kỹ thuật 60–300 ký tự chỉ phát hiện lỗi, không phải quy tắc xếp hạng. Không ghép danh sách từ khóa, không thêm luận điểm bài không có.
4. Ghi `focusQuery` nội bộ, sau đó đối chiếu nội dung rồi lưu `reviewedSourceHash` được báo ở bước 2. Không tự động chép hash hàng loạt để bỏ qua biên tập.
5. Đặt `metadataUpdatedAt` là thời điểm metadata thực sự được sửa (ISO 8601 có múi giờ). Khi thay đổi đáng kể nội dung, thêm `contentModifiedAt` đúng thời điểm sửa. Bỏ trường này nếu không có lịch sử xác thực; không lấy ngày build hay ngày import làm ngày sửa bài.
6. Chạy `npm run check`, `npm run build`, `npm test`. Build dừng nếu thiếu profile, nguồn chưa được rà lại, mô tả trùng, ngày không hợp lệ, hoặc PDF làm mất chữ. Bản nháp không cần profile.
7. Với bài mới có hệ chữ chưa được hỗ trợ, bổ sung font PDF có giấy phép theo `docs/reader-pdf.md`; tuyệt đối không bỏ ký tự để build qua.

Sitemap lấy thời điểm mới nhất trong hai ngày đã lưu. Metadata đổi là một cập nhật trang; `Article.dateModified` chỉ ghi thay đổi nội dung, không đánh đồng hai việc này. Trang cũ không có lịch sử sửa đáng tin cậy sẽ không được gán ngày sửa giả.

## Theo dõi sau triển khai

Trong Search Console của chủ sở hữu, gửi `https://cochinchinepensees.studio/sitemap-index.xml`. Kiểm tra URL Inspection và Rich Results Test trên bài tiếng Việt, bài tiếng Anh, bài có hình và bài dài; kiểm tra Google-selected canonical cùng tình trạng index. Kiểm tra header noindex của một PDF sau deploy vì máy chủ preview Astro không áp dụng `_headers` của Cloudflare.

Lưu baseline Performance (Search results): 28 ngày trước triển khai; URL bài, truy vấn, quốc gia, thiết bị, impressions, clicks, CTR và average position. Theo dõi 28 ngày tiếp theo, đối chiếu cả cùng kỳ nếu dữ liệu đủ; không quy mọi thay đổi cho bản phát hành. Dùng dữ liệu thật để điều chỉnh mô tả khi nó chưa phản ánh đúng bài, không sửa văn bản để nhồi truy vấn. Chưa có quyền Search Console trong tác vụ này nên chưa đo ranking hoặc xác nhận Google đã lập chỉ mục bản mới.

Các bài từng đăng trên Substack cần được theo dõi riêng: self-canonical tại đây không ép được Google bỏ bản Substack. Không tự đổi canonical trên tài khoản xuất bản khác. Chỉ quyết định hướng xử lý khi chủ biên chọn nơi xuất bản chính và có dữ liệu index thực tế.

## Nguồn chính thức

- [Google: Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google: Sitemap và lastmod](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: Snippets](https://developers.google.com/search/docs/appearance/snippet)
- [Google: Robots meta và data-nosnippet](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Google: Canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

Kiểm tra HTTP trước phát hành ngày 09-09-2026: HTTP chuyển 301 sang HTTPS; URL bài có dấu `/` cuối chuyển 307 về đường dẫn chuẩn; URL không tồn tại trả 404. Host `www` chưa phân giải DNS ở môi trường kiểm tra. Bản này giữ canonical không dấu `/` và không đổi DNS của chủ sở hữu; nếu mở host `www` sau này, cấu hình redirect vĩnh viễn về host chính tại Cloudflare.
