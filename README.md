# Hemşire Nöbet Listesi

**Canlı Demo:** [yunus3emre.github.io/nurse_schedule](https://yunus3emre.github.io/nurse_schedule/)

Hemşirelerin aylık vardiya çizelgesini kolayca düzenlemenize, otomatik oluşturmanıza ve dışa aktarmanıza olanak tanıyan tarayıcı tabanlı bir web uygulaması.

## Özellikler

- **Aylık çizelge görünümü** — Tüm hemşireler satır, günler sütun olarak görüntülenir
- **Otomatik çizelge oluşturma** — Yük dengesi, tercihler ve zorunlu kurallar gözetilerek boş hücreler otomatik doldurulur
- **Vardiya tipleri** — Gündüz (D · 8 saat), Gece (N · 16 saat), Gündüz/Gece (D/N · 24 saat), Boş (B) ve Senelik İzin (Sİ)
- **Hemşire tercihleri** — Her hemşireye Gündüz / Fark Etmez / Gece tercihi atanabilir
- **Boş gün talepleri** — B olarak işaretlenen günlere otomatik çizelge atama yapmaz
- **Kural denetimi** — Gece/D/N sonrası zorunlu dinlenme, hafta sonu eşitliği ve boş gün eşitliği otomatik kontrol edilir
- **Türkiye resmi tatilleri** — Sabit ve dini bayramlar otomatik işaretlenir
- **JSON dışa / içe aktarma** — Çizelge verisi JSON olarak kaydedilip geri yüklenebilir
- **Karanlık / Aydınlık tema** — Kullanıcı tercihi tarayıcıda saklanır
- **Mobil uyumlu** — Kart görünümü ve gezinti çubuğu ile küçük ekranlarda çalışır

## Vardiya Kuralları

| Kod | Ad | Süre |
|-----|----|------|
| D | Gündüz | 08:00 – 16:00 (8 saat) |
| N | Gece | 16:00 – 08:00 (16 saat) |
| D/N | Gündüz/Gece | 08:00 – 08:00 (24 saat) |
| B | Boş (İstekli) | Hemşire talebi |
| Sİ | Senelik İzin | Yıllık izin günü |

- **N veya D/N sonrası** ertesi gün aktif vardiya atanamaz (zorunlu dinlenme).
- **Aylık hedef:** 160 saat. Fazlası mesai olarak gösterilir.
- **Hafta sonu eşitliği:** max – min ≤ 1 gün.
- **Boş gün eşitliği:** max – min ≤ 1 gün.

Ayrıntılı kural ve algoritma açıklaması için [ÇizelgeKuralları.md](ÇizelgeKuralları.md) dosyasına bakınız.

## Kurulum

Herhangi bir bağımlılık veya kurulum adımı gerektirmez. Doğrudan tarayıcıda açın:

```bash
# Depoyu klonlayın
git clone https://github.com/Yunus3emre/nurse_schedule.git
cd nurse_schedule

# index.html dosyasını tarayıcıda açın
# (çift tıklama veya Live Server gibi bir uzantı kullanabilirsiniz)
open index.html
```

> **Not:** Uygulama saf HTML + CSS + JavaScript ile yazılmıştır; sunucu, derleme adımı ya da npm gerekmez.

## Kullanım

1. Sağ üstteki **İşlemler Menüsü** butonundan hemşire ekleyin ve tercihlerini girin.
2. Hücrelere tıklayarak vardiya tipini manuel seçin.
3. Minimum kadro sayılarını ayarladıktan sonra **Otomatik Çizelge Oluştur** ile boş hücreleri doldurun.
4. **JSON İndir** ile veriyi kaydedin; **JSON Yükle** ile geri açın.

## Proje Yapısı

```
nurse_schedule/
├── index.html          # Ana uygulama arayüzü
├── style.css           # Tüm stiller (tema, mobil, bileşenler)
├── app.js              # Uygulama mantığı ve otomatik çizelge algoritması
├── ÇizelgeKuralları.md # Kural ve algoritma dokümantasyonu
└── Yapılacaklar.md     # Geliştirme yol haritası
```

## Katkıda Bulunma

Hata bildirimleri ve özellik istekleri için lütfen bir [Issue](../../issues) açın.

## Lisans

Bu proje kişisel kullanım amaçlıdır.
