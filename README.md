# Danh mục sản phẩm Mỹ dạng tĩnh

Website này là cửa hàng sản phẩm tĩnh, lấy dữ liệu từ `data/products.csv` và ảnh sản phẩm từ các thư mục `data/<id>/`.

## Xem thử trên máy

```bash
npm run dev
```

Mở `http://localhost:4173`.

## Triển khai

Đưa các tệp và thư mục sau lên bất kỳ static host nào:

- `index.html`
- `styles.css`
- `app.js`
- `data/products.csv`
- `data/product-images.json`
- các thư mục ảnh `data/<id>/`

Khi có sản phẩm mới, thêm dòng vào `data/products.csv`, thêm ảnh vào thư mục `data/<id>/`, tạo lại `data/product-images.json`, rồi triển khai lại các tệp tĩnh.
