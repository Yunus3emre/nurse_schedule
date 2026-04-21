# Hemşire Nöbet Çizelgesi — Kurallar ve Algoritma

## 1. Vardiya Türleri

| Kod | Ad | Süre | Saat Aralığı |
|-----|----|------|--------------|
| D   | Gündüz | 8 saat | 08:00 – 16:00 |
| N   | Gece | 16 saat | 16:00 – 08:00 |
| D/N | Gündüz/Gece | 24 saat | 08:00 – 08:00 |
| B   | Boş (İstekli) | — | Hemşirenin talep ettiği boş gün |
| Sİ  | Senelik İzin | — | Yıllık izin günü |
| —   | Atanmamış | 0 | Henüz çizelgeye girilmemiş |

---

## 2. Dinlenme Zorunlulukları (Zorunlu Kurallar)

1. **Gece (N) sonrası zorunlu dinlenme:** Gece vardiyası çalışan hemşire, ertesi gün herhangi bir aktif vardiyaya (D, N, D/N) atanamaz. Ertesi gün ancak `empty`, `B` veya `Sİ` olabilir.
2. **D/N sonrası zorunlu dinlenme:** 24 saat çalışan hemşire, ertesi gün herhangi bir aktif vardiyaya (D, N, D/N) atanamaz. Ertesi gün ancak `empty`, `B` veya `Sİ` olabilir.
3. **Ardışık gündüz ve zorunlu mola:** Ardışık gündüz serisi bittikten sonra hemşire **en az 1 gün**, **en fazla 3 gün** boş (empty/B) kalmalıdır. 3 günlük molanın ardından algoritma hemşireyi tekrar çalışmaya önceliklendirir.
4. **Haftasonu eşitliği:** Algoritma Cumartesi ve Pazar günlerindeki atamayı herkese eşit dağıtmaya çalışır. Daha az haftasonu çalışmış hemşire, haftasonu günlerinde öncelikli seçilir. Hedef: **max – min ≤ 1 gün.** Mümkünse herkesin haftasonu vardiya sayısı aynı olmalı; kaçınılmazsa en fazla 1 gün fark kabul edilir. Bir hemşire 5 gün haftasonu alırken başka birinin 1 gün alması kural ihlalidir.
5. **Boş gün eşitliği:** Her hemşirenin aylık boş (atanmamış/`B`) gün sayısı birbirine yakın olmalıdır. Hedef: **max – min ≤ 1 gün.**
6. Bu kurallar hem manuel atamada hem otomatik çizelgede uygulanmalıdır.

---

## 3. Aylık Çalışma Hedefi

- Hedef: **160 saat/ay**
- İzin günleri (Sİ) 160 saatten düşülür. (Her Sİ günü = 8 saat eksik)
- 160 saatin üzerindeki çalışma **mesai** olarak gösterilir ve toplam sütununda belirtilir.
- Hafta içi izin kullanılabilir.

### 3.1 Mesai Eşitliği Kuralı

- Takımın **%30 veya daha fazlası** mesai (>160 saat) yapıyorsa, **herkesin** mesai alması zorunludur; mesaisiz hemşire bırakılamaz.
- Mesai yapan hemşireler arasındaki **maksimum–minimum fark ≤ 8 saat** olmalıdır.
- %30 eşiğinin altında kalan durumlarda bu kural aktif değildir (birkaç hemşirenin küçük fazla saati tolere edilir).

---

## 4. Hemşire Tercihleri

- Her hemşireye bir **vardiya tercihi** atanabilir: `☀️ Gündüz` | `⚖️ Fark Etmez` | `🌙 Gece`
- Otomatik çizelge bu tercihleri puanlama sistemine dahil eder (tercih eşleşmesi öncelik sağlar).
- Hemşireler **boş gün talebinde** bulunabilir (`B` durumu). Otomatik çizelge bu günlere atama yapmaz.

---

## 5. Günlük Minimum Kadro

- Her gün için minimum **gündüz hemşiresi sayısı** ve minimum **gece hemşiresi sayısı** belirlenir.
- **Hafta içi** ve **haftasonu** için bu minimumlar ayrı ayrı ayarlanabilir.
- Toplam günlük minimum = minGündüz + minGece
- Mevcut hemşire sayısı bu minimumun altındaysa otomatik çizelge o günü atlar ve kullanıcıyı uyarır.

---

## 6. Otomatik Çizelge Algoritması

### 6.1 Ön Koşullar

- Çalışan hemşire listesi hazır ve tercihleri girilmiş olmalıdır.
- Minimum kadro sayıları (gündüz / gece, hafta içi / sonu) belirlenmiş olmalıdır.
- Senelik izin (`Sİ`) ve boş gün talepleri (`B`) önceden işlenmiş olmalıdır.

### 6.2 Mevcut Verilerin Korunması

- Otomatik çizelge çalıştırıldığında **yalnızca `empty` hücreler** doldurulur.
- `Sİ`, `B`, ve kullanıcının manuel girdiği `D`, `N`, `D/N` değerleri **dokunulmaz**.

### 6.3 Müsaitlik Kontrolü

Her gün için atama yapılmadan önce hemşirenin o güne müsait olup olmadığı kontrol edilir:

```
isMüsait(hemşire, gün) = true  eğer:
  - sch[hemşire][gün] === 'empty'    (atanmamış)
  - sch[hemşire][gün-1] !== 'N'      (gece dinlenme kuralı)
  - sch[hemşire][gün-1] !== 'D/N'    (24 saat dinlenme kuralı — D ataması için)
```

### 6.4 Puanlama ve Sıralama

Her gün, müsait hemşireler **skor** ile sıralanır. **Düşük skor = önce seçilir.**

```
puan(hemşire, vardiyaTipi) =
  prefScore(hemşire, vardiyaTipi)   // tercih uyumu
  + shiftCount[hemşire] × 2         // yük dengesi (fazla çalışana ceza)
  + random() × 1.5                  // rastgelelik (~%30 doğallık)
```

**prefScore tablosu:**

| Tercih | Atanan Vardiya | Skor |
|--------|----------------|------|
| Gündüz | Gündüz | −4 (öncelikli) |
| Gece   | Gece   | −4 (öncelikli) |
| Fark Etmez | Herhangi | 0 |
| Gündüz | Gece   | +5 (son seçenek) |
| Gece   | Gündüz | +5 (son seçenek) |

### 6.5 Atama Sırası

Her gün için:

1. Müsait hemşireler belirlenir.
2. Gündüz havuzu sıralanır → en düşük puanlı `minGündüz` hemşire D alır.
3. Gündüz atanan hemşireler gece havuzundan çıkarılır.
4. Kalan havuz gece için sıralanır → en düşük puanlı `minGece` hemşire N alır.
5. Atama yapılan hemşirelerin `shiftCount` değeri +1 artar.

### 6.6 Uyarı Durumları

| Durum | Tepki |
|-------|-------|
| Müsait hemşire < minGündüz + minGece | O gün atlanır, skipped sayacı artar |
| Ay sonunda skipped > 0 | Toast uyarısı: "X gün atlandı (yetersiz hemşire)" |
| Bir hemşireye çok fazla vardiya düştüyse | Uyarı mesajı (eşik: ortalama × 1.5) |

---

## 7. Hemşire Listesi Yönetimi

- Hemşireler **belirli bir ay itibarıyla** listeden çıkarılabilir (doğum izni, istifa vb.).
- Çıkarılan hemşirenin **geçmiş ayları** uygulamada korunur, yalnızca ileri ay çizelgelerinde görünmez.
- Hemşire silinirken "hangi aydan itibaren?" sorusu sorulur.

---

## 8. Tatil ve Hafta Sonu

- Türkiye resmi tatilleri otomatik olarak işaretlenir (sabit + dini bayramlar).
- Hafta sonu (Cumartesi, Pazar) görsel olarak ayrıştırılır.
- Resmi tatiller hafta içine denk geldiğinde ayrı renk ile gösterilir.

---

## 9. Gelecek Geliştirmeler (Backlog)

- [ ] Hafta içi / haftasonu için ayrı minimum kadro parametreleri
- [ ] Aylık 160 saat hedefine göre mesai hesabı ve görselleştirme
- [ ] Gece sonrası zorunlu dinlenme kuralının otomatik kontrolü
- [ ] Mevcut atamaların üzerine yalnızca `empty` hücreleri doldurma (kısmen mevcut)
- [ ] Yetersiz kadro veya aşırı yük uyarıları
- [ ] Hemşire bazlı aylık aktivasyon / deaktivasyon
- [ ] Boş gün talebi (`B`) otomatik çizelgede dikkate alınması (kısmen mevcut — `B` atlanıyor)
- [ ] PDF dışa/içe aktarma
- [ ] Otomatik testler (fazla yük, izin çakışması, gece dinlenme ihlali senaryoları)
