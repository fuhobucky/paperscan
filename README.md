# PaperScan Studio

Ứng dụng scan tài liệu dạng PWA với **React 19, Next.js App Router, TypeScript, Tailwind CSS và Shadcn/ui**. OCR chạy ngay trên thiết bị bằng Tesseract.js; xuất PDF bằng pdf-lib. Không cần API key, tài khoản trong ứng dụng hoặc backend dữ liệu.

## Chạy mã nguồn

Cần Node.js **22.13+** và pnpm theo `packageManager` trong `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:next
```

Mở địa chỉ do Next.js in ra, thông thường `http://localhost:3000`. Camera hoạt động trên localhost của máy đang mở trình duyệt. Muốn mở trên điện thoại, hãy dùng bản triển khai **HTTPS**; địa chỉ HTTP trong mạng LAN không đủ cho WebRTC/service worker.

Tesseract có postinstall chỉ in thông tin tài trợ. Dự án chủ động không chạy script đó (`allowBuilds.tesseract.js: false`), dùng các bundle dựng sẵn trong package. Không cần bật quyền chạy script này.

## Build và triển khai

```bash
pnpm build
```

Build tạo **`out/`**, chứa HTML, JS, CSS, manifest, icon, service worker, OCR/WASM/ngôn ngữ và trình đọc PDF. Có thể triển khai nguyên thư mục `out/` lên một máy chủ static hỗ trợ HTTPS. Không chỉ upload `index.html`.

Để thử bản production trên máy:

```bash
python3 -m http.server 8080 --directory out
```

Mở `http://localhost:8080`, đợi mục **“Đã sẵn sàng dùng offline”** xuất hiện, sau đó thử tắt mạng và mở lại. Bản dev không đăng ký service worker production để tránh cache lẫn với HMR; trạng thái offline trong dev có thể chưa sẵn sàng.

`pnpm build:next` tương đương `pnpm build`. Dự án còn giữ các cấu hình tương thích Vinext/Cloudflare của môi trường tạo web, nhưng bản phân phối chính là **Next.js static export**, không cần chạy Cloudflare Worker. Script `dev:next` là lựa chọn đơn giản để phát triển trên máy cá nhân.

Cấu hình server:

- Phục vụ ở root của một origin (`/`), không nằm trong thư mục con. Đổi toàn bộ URL worker/manifest/asset nếu muốn dùng subpath.
- `/sw.js`: nên gửi `Cache-Control: no-cache`; không đánh dấu immutable.
- `.wasm`: `application/wasm`; `.js`/`.mjs`: JavaScript MIME; manifest: `application/manifest+json`.
- Không chuyển các URL tài nguyên bị thiếu thành `index.html` (soft 404).
- Không đặt CSP chặn Web Worker/WebAssembly. Nếu thiết lập CSP, cho phép nguồn `self`, worker `self`, ảnh `self blob: data:`, và WebAssembly theo khả năng trình duyệt. Không mở CORS cho tài liệu người dùng: ứng dụng không upload chúng.

## Triển khai lên Render

Dự án có `render.yaml` dành cho **Static Site**. Đưa mã nguồn lên một repository GitHub/GitLab/Bitbucket mà Render được phép đọc, rồi tạo Blueprint từ repository đó. Giữ các tệp `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `scripts/` và mã ứng dụng trong cùng thư mục gốc.

Nếu tạo service bằng Dashboard hoặc API, dùng các giá trị sau:

| Cấu hình | Giá trị |
|---|---|
| Loại service | Static Site (`static_site` trong REST API) |
| Build command | `corepack pnpm install --frozen-lockfile && corepack pnpm build` |
| Publish directory | `out` |
| `NODE_VERSION` | `24` |
| `SKIP_INSTALL_DEPS` | `true` |
| `NEXT_TELEMETRY_DISABLED` | `1` |
| Header cho `/*` | `Cache-Control: no-cache` |
| Header cho `/sw.js` | `Service-Worker-Allowed: /` |

Blueprint tắt tự động deploy để chủ động chọn thời điểm cập nhật bản thử nghiệm; có thể bật lại trong Render sau. Không cần Start Command, database, disk hoặc biến môi trường API của ứng dụng. Không đưa Render API key vào mã nguồn, Blueprint hoặc biến `NEXT_PUBLIC_*`.

Sau khi deploy thành công, mở URL HTTPS Render cung cấp, kiểm tra nhập ảnh, OCR, xuất PDF và đợi chỉ báo offline sẵn sàng trước khi tắt mạng. Dữ liệu tài liệu nằm theo origin: URL Render mới có thư viện riêng với URL triển khai cũ.

Tham khảo: [Render Static Sites](https://render.com/docs/static-sites), [Blueprint reference](https://render.com/docs/blueprint-spec), [Next.js on Render](https://render.com/docs/deploy-nextjs-app).

## Tính năng

| Luồng | Cách triển khai |
|---|---|
| Camera toàn màn hình | `getUserMedia`, ưu tiên camera sau, `playsInline`, không thu âm, chụp nhiều trang |
| Nhập tệp | Chọn nhiều ảnh hoặc kéo thả ảnh/PDF vào workspace; ảnh JPEG/PNG/WebP và định dạng mà browser giải mã được |
| PDF đầu vào | PDF.js raster hóa từng trang, giữ thứ tự, hỗ trợ font/cmap/WASM được đóng gói cục bộ |
| Perspective crop | Kéo bốn góc, kiểm tra tứ giác lồi, giải homography 8 ẩn, lấy mẫu song tuyến tính |
| Bộ lọc | Gốc, B&W thích nghi theo vùng sáng, Magic Color tăng tương phản/màu, Thang xám |
| Xoay | Quay từng bước 90° sau khi cắt phối cảnh |
| Sắp xếp | Kéo tay nắm bằng chuột/chạm; hỗ trợ bàn phím và nút lên/trước, xuống/sau |
| OCR | Tesseract.js, LSTM, bộ `vie` + `eng`, Web Worker, tiến trình và nút Hủy |
| Xuất | PDF nhiều trang theo thứ tự/bộ lọc hiện tại, JPEG trang đang chọn; tải về hoặc Web Share nếu browser hỗ trợ |
| Lưu | IndexedDB chứa Blob ảnh gốc, ảnh kết quả, thumbnail, OCR và metadata; ghi transaction atomically |
| Responsive | Desktop: thư viện + workspace + bảng chỉnh sửa; tablet: split-view; mobile: drawer thư viện, bottom sheet và FAB scan |
| PWA | Manifest, icon thường/maskable, Apple touch icon, service worker precache toàn bộ chức năng offline |
| Giao diện | Light/Dark, thao tác cảm ứng, phóng to, nhãn nút, reduced motion, lỗi và trạng thái trống |

Không có dữ liệu mẫu được chèn vào thư viện. Trang đầu tiên là trạng thái trống thực, có thể chụp hoặc nhập tài liệu ngay.

## Cách sử dụng

1. Chọn **Quét tài liệu** hoặc **Nhập ảnh hoặc PDF**.
2. Trong camera, bấm chụp nhiều lần rồi **Lưu**. Sau chụp, ứng dụng mở trình căn chỉnh bốn góc cho trang đầu vừa thêm.
3. Chọn một trang bằng thumbnail hoặc vuốt trái/phải ở chế độ 100% trên mobile.
4. Dùng **Cắt 4 góc**, **Xoay 90°** và bộ lọc. Ảnh gốc giữ nguyên nên có thể chỉnh lại hoặc khôi phục.
5. Kéo tay nắm dưới thumbnail để sắp xếp; thay đổi được lưu tự động. Có thể xóa từng trang, nhưng không xóa trang cuối cùng.
6. Bấm **Nhận diện văn bản** để đọc tất cả trang bằng tiếng Việt + Anh. Kết quả lưu cùng tài liệu; có thể chọn/sao chép trong bảng OCR.
7. Bấm **Xuất PDF**. Ứng dụng chuẩn bị tệp rồi hiển thị nút Tải về/Chia sẻ. Bước thứ hai giữ user gesture để Web Share hoạt động đúng trên mobile.
8. Trong tài liệu đang mở, **Thêm trang** nhập thêm ảnh/PDF; nút Scan nổi chụp thêm trang. Nút Quét tài liệu mới ở thư viện tạo tài liệu riêng.

## Cài PWA và offline

- **iPhone/iPad:** mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính. Không có `beforeinstallprompt` chung cho iOS; ứng dụng hiển thị hướng dẫn riêng.
- **Android:** dùng nút Cài ứng dụng khi browser cung cấp prompt, hoặc menu cài đặt.
- **Desktop:** cài từ Chrome/Edge hoặc tùy chọn cài web app của trình duyệt hỗ trợ.

Lần đầu cần mạng để tải ứng dụng và các mô hình OCR, tổng tài nguyên khoảng **27 MB** trước nén truyền tải. Chỉ báo offline bật sau khi service worker hoàn tất cài đặt. OCR không phụ thuộc CDN lúc chạy: worker, bốn biến thể core WASM và dữ liệu `vie`/`eng` được phục vụ cùng origin.

Service worker dùng bản chụp tài nguyên đồng nhất theo build: shell HTML, toàn bộ chunk kể cả import động, worker ảnh, PDF worker/fonts, OCR và ngôn ngữ. Lượt cập nhật chờ các cửa sổ cũ đóng trước khi kích hoạt, tránh trộn HTML mới và JS cũ. Không cache yêu cầu ngoài origin hoặc dữ liệu gửi qua POST.

Offline cần đã mở và tải xong ít nhất một lần. Không thể cài hoặc dùng app chưa từng tải khi hoàn toàn mất mạng. Khi app có bản mới, đóng tất cả cửa sổ PWA/tab rồi mở lại để chuyển phiên bản.

## Quyền và dữ liệu

Web app không dùng `Info.plist`:

- Browser hỏi quyền camera khi người dùng mở chức năng scan. Audio luôn `false`.
- Camera yêu cầu HTTPS/localhost. Bị từ chối quyền, không có thiết bị hoặc camera bận sẽ có thông báo và lựa chọn nhập ảnh.
- Chọn tệp bằng input/file picker không yêu cầu quyền đọc toàn bộ thư viện.
- Clipboard/Web Share có thể cần HTTPS, thao tác người dùng và browser hỗ trợ; có đường lui chọn/copy văn bản hoặc tải tệp.
- Ảnh, PDF nhập và văn bản không gửi tới server. Server chỉ phân phối mã và mô hình công khai. Không có đồng bộ đa thiết bị.
- Dữ liệu nằm trong IndexedDB của **origin + hồ sơ trình duyệt** hiện tại. Xóa site data, chế độ riêng tư hoặc hệ điều hành thu hồi dung lượng có thể làm mất dữ liệu. Hãy xuất PDF cần giữ lâu.
- Có tùy chọn `navigator.storage.persist()` để đề nghị browser ưu tiên giữ dữ liệu. Đây không phải bảo đảm lưu vĩnh viễn.

## Kiến trúc mã nguồn

| Đường dẫn | Trách nhiệm |
|---|---|
| `app/page.tsx`, `app/layout.tsx` | App Router, metadata và điểm vào Studio |
| `app/globals.css` | Theme Tailwind, responsive, camera/editor layout |
| `components/scan/studio.tsx` | Điều phối tài liệu, lưu, OCR, export và màn hình chính |
| `components/scan/camera.tsx` | Vòng đời MediaStream, chụp nhiều ảnh, dừng camera khi đóng/rời app |
| `components/scan/crop-editor.tsx` | Kéo góc bằng pointer/keyboard, ánh xạ theo đúng kích thước ảnh hiển thị |
| `components/scan/page-strip.tsx` | Sắp xếp trang bằng dnd-kit |
| `components/scan/pwa.tsx` | Đăng ký worker, trạng thái online/offline và install prompt |
| `components/scan/blob-image.tsx` | Vòng đời Object URL; revoke khi thay ảnh/unmount |
| `components/ui/` | Các primitive Shadcn có sẵn |
| `lib/scan/storage.ts` | IndexedDB, revision guard và transaction |
| `lib/scan/image-math.ts` | Homography, bilinear sampling, integral-image threshold |
| `lib/scan/processing.worker.ts` | Chạy phép xử lý pixel ngoài UI thread |
| `lib/scan/images.ts` | Giải mã, chuẩn hóa, Canvas, giao tiếp worker và JPEG |
| `lib/scan/import-export.ts` | PDF.js nhập tệp, pdf-lib xuất PDF, download |
| `lib/scan/ocr.ts` | Tesseract worker, hủy tác vụ, OCR nhiều trang |
| `lib/scan/types.ts` | Document/Page/Filter/Quad và giới hạn |
| `lib/scan/webmcp.ts` | Đăng ký tùy khả năng: liệt kê metadata/mở tài liệu cho browser hỗ trợ WebMCP |
| `scripts/prepare-pwa-assets.mjs` | Sao chép worker/core/language/PDF asset từ các package đã khóa phiên bản |
| `scripts/build-next.mjs` | Build static export và tạo service worker |
| `scripts/generate-service-worker.mjs` | Tự tạo precache từ toàn bộ output, hash theo phiên bản |
| `scripts/test-core.mjs` | Kiểm tra hình học/bộ lọc và vòng đời cache bằng Node |
| `public/` | Favicon, PWA icons, manifest và tài nguyên cục bộ được dựng lại |

Bản ZIP mã nguồn bỏ qua `node_modules`, build output và các bản sao mô hình OCR/PDF. `pnpm install` rồi script chuẩn bị tài nguyên sẽ dựng lại các tệp này từ lockfile. Không cần tải thủ công mô hình hoặc sửa CDN URL.

Ảnh gốc không bị ghi đè. Metadata mô tả `crop`, `rotation`, `filter`; ảnh kết quả và thumbnail được dựng từ gốc. Khi sửa ảnh, OCR cũ của trang đó bị xóa để không hiển thị nội dung lỗi thời. Ghi IndexedDB theo transaction; revision guard từ chối ghi đè dữ liệu cũ nếu cửa sổ khác đã sửa. BroadcastChannel làm mới danh sách giữa các tab.

## Giới hạn có chủ đích

- 40 trang/tài liệu, 40 MB/tệp; ảnh chuẩn hóa cạnh dài tối đa 2.400 px. PDF nhập tối đa 2.200 px/cạnh mỗi trang và được xử lý tuần tự. Hiệu năng thực phụ thuộc RAM/CPU; thiết bị yếu nên chia lô nhỏ.
- Khung camera là khung căn chỉnh bằng mắt, **chưa tự phát hiện biên hoặc tự bấm chụp như VisionKit**. Cắt phối cảnh thực hiện bằng bốn góc người dùng đặt.
- Magic Color là preset tăng màu/tương phản của ứng dụng, không phải thuật toán độc quyền CamScanner. B&W là ngưỡng thích nghi, có thể mất nét mảnh hoặc ảnh minh họa; luôn có Gốc để phục hồi.
- PDF đầu vào được raster hóa. PDF xuất chứa ảnh, **chưa có lớp OCR có thể tìm kiếm/chọn chữ** và không giữ chữ ký số, form, link hoặc cấu trúc PDF đầu vào.
- PDF có mật khẩu cần mở khóa trước. HEIC tùy khả năng giải mã của browser; khi không hỗ trợ, đổi sang JPEG/PNG.
- File API, Canvas, IndexedDB, Worker, WebAssembly, MediaDevices, ResizeObserver và Service Worker cần browser hiện đại. Tesseract và PDF.js không đảm bảo các bản iOS/Safari cũ; kiểm tra trên các phiên bản thiết bị mục tiêu.
- Hai thao tác WebMCP là tùy chọn tăng khả năng tương tác với agent; ứng dụng vẫn chạy khi browser không hỗ trợ chuẩn này.

## Kiểm tra đã thực hiện

```bash
pnpm typecheck
pnpm build
pnpm test:core
```

Trong môi trường tạo mã:

- TypeScript strict check đã qua.
- Next.js production static export đã thành công; đường `/` được prerender.
- Build Vinext/Cloudflare tương thích cũng đã thành công trong quá trình phát triển; bản phân phối cuối là static Next.js.
- Test toán học: tứ giác lồi, góc giao nhau, homography khớp cả bốn góc, ánh xạ toàn ảnh không mất pixel/kích thước.
- Test pixel: grayscale, B&W hai mức, giữ dữ liệu đầu vào bất biến.
- Test service worker bằng VM: install, activate, shell/OCR khi không có mạng, bỏ qua request ngoài origin.
- Chạy Tesseract với **mô hình Việt/Anh cục bộ** trên ảnh kiểm tra tổng tiền và nhận diện thành công, không tải model từ CDN.

**Chưa thực hiện browser/device end-to-end QA.** Test VM/Node không thay thế thao tác camera thật, Safari PWA, cảm ứng, Share Sheet hoặc IndexedDB trong browser. Chưa có môi trường WebMCP browser được phép kiểm tra runtime trong phiên này.

Trước phát hành rộng rãi, kiểm tra trên iPhone/Safari, Android/Chrome và desktop:

1. Camera cho phép/từ chối/bận; xoay thiết bị; ra nền rồi mở lại; đóng camera không còn đèn sử dụng camera.
2. Nhập ảnh nhiều hướng, PDF nhiều trang/font; thử file quá giới hạn và PDF có mật khẩu.
3. Crop giấy nghiêng, bốn góc giao nhau, xoay và khôi phục; kéo trang bằng touch/keyboard.
4. Chạy/hủy OCR, chỉnh lại ảnh rồi OCR lại; kiểm tra nội dung tiếng Việt có dấu.
5. Export PDF/JPEG, mở trong ứng dụng ngoài; kiểm tra số trang và thứ tự.
6. Reload sau lưu, mở hai tab sửa cùng tài liệu; mô phỏng đầy bộ nhớ.
7. Chờ offline sẵn sàng, cài lên home screen, đóng rồi bật lại trong airplane mode; thử camera/crop/OCR/export.
8. Kiểm tra Dark Mode, VoiceOver, phóng to chữ 200%, mobile ngang/dọc và tablet split-view.

## Nguồn tài liệu chính

- [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)
- [Tesseract.js local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)
- [PDF.js examples](https://mozilla.github.io/pdf.js/examples/)
- [pdf-lib](https://pdf-lib.js.org/)
- [MDN — Offline operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [MDN — Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

Các package giữ giấy phép riêng trong distribution/package tương ứng. Các bản sao license cho OCR/PDF nằm trong `public/licenses` sau bước chuẩn bị tài nguyên.
