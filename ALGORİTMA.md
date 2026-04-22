# Çizelge Oluşturma Algoritması — Detaylı Teknik Açıklama

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Temel Kavramlar](#temel-kavramlar)
3. [Algoritmanın Adım Adım Çalışması](#algoritmanın-adım-adım-çalışması)
4. [Puanlama Sistemi](#puanlama-sistemi)
5. [Kısıtlar (Constraints)](#kısıtlar-constraints)
6. [Tekrar Deneme Mekanizması (Retry)](#tekrar-deneme-mekanizması-retry)
7. [Aynı Şartlarda Neden Farklı Sonuç Çıkar?](#aynı-şartlarda-neden-farklı-sonuç-çıkar)
8. [Tercih Sistemi](#tercih-sistemi)
9. [Aylık Hedef ve Mesai Hesabı](#aylık-hedef-ve-mesai-hesabı)
10. [Başarı Kriterleri ve Test Kuralları](#başarı-kriterleri-ve-test-kuralları)

---

## Genel Bakış

Sistem, **açgözlü (greedy) günlük atama** algoritması kullanır. Her gün için hemşireler puanlanır ve en uygun hemşireler o güne atanır. Algoritma deterministik değildir — her çalıştırmada rastgelelik bileşeni sayesinde farklı ama eşit derecede geçerli çizelgeler üretebilir.

```
Ay boyunca her gün için:
  → Uygun hemşireler belirlenir (kısıtlar)
  → Her hemşire puanlanır (tercih + yük + dinlenme + rastgelelik)
  → En düşük puanlı hemşireler seçilir
  → Atama yapılır, yük sayacı güncellenir
```

---

## Temel Kavramlar

### Vardiya Türleri

| Kod | Açıklama | Saat |
|-----|----------|------|
| `D` | Gündüz vardiyası | 8 saat |
| `N` | Gece vardiyası | 16 saat |
| `D/N` | Gündüz + Gece (24 saat) | 24 saat |
| `Sİ` | İzin | 0 saat |
| `B` | Boş/İzin günü | 0 saat |
| *(boş)* | Henüz atanmamış | — |

### Minimum Kadro İhtiyacı

- **Hafta içi:** Gündüz için minimum `D_MIN`, gece için `N_MIN` hemşire
- **Hafta sonu / Resmi tatil:** Daha düşük minimum kadro

---

## Algoritmanın Adım Adım Çalışması

Algoritma `_buildScheduleFromSnapshot()` fonksiyonunda (app.js, satır 803–890) tanımlanmıştır.

### Aşama 1 — Hazırlık

```
1. Mevcut çizelge verisi (snapshot) alınır
2. Her hemşirenin o ana kadar çalıştığı saat (hourLoad) hesaplanır
3. Her hemşirenin hafta sonu çalışma sayısı (weLoad) hesaplanır
```

### Aşama 2 — Günlük Atama Döngüsü

Ayın her günü için (1'den N'e kadar):

```
A) Günün tipi belirlenir:
   - Hafta sonu mu? (Cumartesi/Pazar)
   - Resmi tatil mi? (Türk tatil takvimi)
   → Minimum kadro sayısı seçilir

B) Her hemşire için isAvailable() kontrolü yapılır:
   - Gece vardiyasından sonra gün içi yasak mı?
   - Üst üste 2+ gün çalışmış mı?
   - Hücre zaten dolu mu? (İzin, manuel giriş, vs.)

C) Uygun hemşireler için puan hesaplanır (sortForShift):
   puan = tercihPuanı + yükCezası + dinlenmeBonusu + haftaSonuCezası + rastgelelik

D) En düşük puanlı hemşireler seçilir:
   - İlk D_MIN kişi → Gündüz vardiyası
   - Sonraki N_MIN kişi → Gece vardiyası

E) Atama yapılır, hourLoad ve weLoad güncellenir
```

### Aşama 3 — Değerlendirme

Oluşturulan çizelge `_evaluateSchedule()` fonksiyonuyla 3 kurala göre değerlendirilir (pass/warn/fail).

---

## Puanlama Sistemi

Her hemşire için hesaplanan puan formülü (app.js, satır 861):

```javascript
puan = prefScore(hemşire, vardiiyaTürü)
     + (hourLoad[hemşire] / 8) * 2
     + restBonus
     + weBonus
     + Math.random() * 1.5
```

**En düşük puanlı hemşire önce seçilir.** Her bileşenin rolü:

### 1. Tercih Puanı (`prefScore`)

Hemşirenin tercihine göre uyumluluğu ödüllendirir ya da cezalandırır.

| Tercih | Gündüz Puanı | Gece Puanı |
|--------|-------------|------------|
| `day-only` | **-6** (çok istekli) | +10 (kaçınılır) |
| `day-prefer` | -4 | +3 |
| `any` | 0 | 0 |
| `night-prefer` | +3 | -4 |
| `night-only` | +10 | **-6** (çok istekli) |

Düşük puan = daha erken seçilir → Tercih uyumu sağlanır.

### 2. Yük Cezası (`hourLoad / 8 * 2`)

```
hourLoad = Hemşirenin bu aya kadar çalıştığı toplam saat
Ceza     = (hourLoad / 8) × 2
```

Az çalışmış hemşire → düşük ceza → önce seçilir.  
Bu bileşen **yük dengelemeyi** sağlar.

### 3. Dinlenme Bonusu (`restBonus`)

Hemşire art arda gündüz çalışıp en az 3 gün dinlendiyse **-4 bonus** alır.  
Bu, uzun dinlenme sonrası hemşirenin tekrar aktif rotasyona girmesini teşvik eder.

### 4. Hafta Sonu Cezası (`weBonus`)

```
weBonus = weLoad[hemşire] × 2   (hafta sonlarında)
weBonus = 0                      (hafta içi)
```

Çok hafta sonu çalışmış hemşire → yüksek ceza → hafta sonları daha az seçilir.  
Bu bileşen **hafta sonu eşitliğini** sağlar.

### 5. Rastgelelik (`Math.random() * 1.5`)

Her hemşire için her gün `0` ile `1.5` arasında rastgele bir sayı eklenir.

Bu bileşen:
- Puanlar yakın olduğunda farklı hemşirelerin seçilmesini sağlar
- Her çalıştırmada farklı ama eşit derecede geçerli sonuçlar üretir
- Bir "tohum" (seed) kullanılmaz — tamamen rastgeledir

---

## Kısıtlar (Constraints)

### Sert Kısıtlar — Kesinlikle Uygulanır

Bu kurallara uymayan hemşire o gün için **hiçbir koşulda seçilemez**:

| Kural | Açıklama |
|-------|----------|
| **Gece Sonrası Dinlenme** | Gece (N) veya Gündüz+Gece (D/N) vardiyasından sonra hemşire ertesi gün çalışamaz |
| **Ardışık Gün Sınırı** | Üst üste 2 günden fazla gündüz (D) vardiyası yapılamaz |
| **Dolu Hücre Koruması** | İzin, B, veya manuel girilen hücreler otomatik çizelge tarafından değiştirilemez |

### Yumuşak Kısıtlar — Test Kurallarıyla Değerlendirilir

Bu kurallar ihlal edilirse çizelge başarısız sayılır ama algoritma devam eder (retry):

| Test | Kural |
|------|-------|
| **Test 1 — Fazla Mesai Eşitliği** | Hemşirelerin %30'u 160 saati aşıyorsa, tümü aşmalı ve fark ≤8 saat olmalı |
| **Test 2 — Hafta Sonu Eşitliği** | En çok ve en az hafta sonu çalışan hemşire arasındaki fark ≤1 gün olmalı |
| **Test 3 — İzin Günü Eşitliği** | En çok ve en az boş günü olan hemşire arasındaki fark ≤1 gün olmalı |

---

## Tekrar Deneme Mekanizması (Retry)

Tek bir deneme her zaman en iyi çizelgeyi üretmeyebilir. Bu nedenle sistem **en fazla 20 deneme** yapar (`MAX_AUTO_RETRIES = 20`).

```
Döngü (en fazla 20 kez):
  1. _buildScheduleFromSnapshot() → Yeni çizelge oluştur
  2. _evaluateSchedule()          → 3 kuralı test et
  3. Eğer en az 1 test geçtiyse  → Hemen uygula, döngüden çık  ✅
  4. Tüm denemeler başarısızsa    → En yüksek skoru alanı uygula ⚠️
```

### Skor Hesabı (Retry İçin)

```
skor = (geçen test sayısı × 10) + (uyarı sayısı × 1)
```

20 denemeden sonra hepsi başarısız olsa bile en iyi skorlu çizelge seçilir.

### Kullanıcıya Gösterilen Bilgi

Her denemenin sonucu kayıt altına alınır ve modal pencerede gösterilir:
- ✅ = Test geçti
- ⚠️ = Uyarı (kısmen geçti)
- ❌ = Başarısız

---

## Aynı Şartlarda Neden Farklı Sonuç Çıkar?

**Kısa cevap:** Puanlama formülündeki `Math.random() * 1.5` bileşeni her çalıştırmada farklı değer alır.

### Mekanizma: Rastgelelik + Retry

Şu senaryoyu düşünelim:

```
Hemşire A puanı: 3.2 (yük + tercih)
Hemşire B puanı: 3.4 (yük + tercih)

İlk çalıştırma:
  A'ya eklenen rastgele: +0.3 → Toplam: 3.5
  B'ye eklenen rastgele: +0.9 → Toplam: 4.3
  → A seçilir

İkinci çalıştırma:
  A'ya eklenen rastgele: +1.1 → Toplam: 4.3
  B'ye eklenen rastgele: +0.2 → Toplam: 3.6
  → B seçilir
```

Puanlar yakın olan hemşireler için **1.5 puanlık rastgele aralık**, seçimi değiştirebilecek kadar büyüktür.

### Neden Bu Kasıtlı Bir Tasarım?

1. **Eşit yük dağılımı:** Aynı puanlı hemşireler arasında rotasyon sağlanır — hep aynı kişi seçilmez
2. **Çeşitli alternatifler:** 20 denemenin her biri farklı bir olası çizelge üretir; sistem en iyisini seçer
3. **Yerel minimumdan kaçış:** Deterministic bir algoritma her seferinde aynı "sıkışmış" sonucu verir; rastgelelik bunu önler

### Kaç Denemede Başarı Sağlanır?

Tipik koşullarda (8–12 hemşire, normal ay):
- **1–3 deneme** içinde en az 1 test geçen çizelge bulunur
- Çok kısıtlayıcı şartlarda (birçok izin + az hemşire) 10–20 deneme gerekebilir

---

## Tercih Sistemi

Her hemşire için 5 tercih seviyesi tanımlanabilir:

```
day-only    → Sadece gündüz, gece vardiyas kesinlikle istenmiyor
day-prefer  → Gündüz tercihli, gerekirse gece
any         → Fark etmez
night-prefer→ Gece tercihli, gerekirse gündüz
night-only  → Sadece gece, gündüz vardiyas kesinlikle istenmiyor
```

Tercih puanları (±10 aralığında) yük dengeleme cezasından (~2–8 arası) **daha güçlüdür**, bu yüzden tercihler genellikle gözetilir. Ancak hemşire sayısı yetersiz kaldığında tercih dışı atamalar yapılabilir.

**Geriye dönük uyumluluk:** Eski `day` / `night` değerleri otomatik olarak `day-prefer` / `night-prefer`'e dönüştürülür.

---

## Aylık Hedef ve Mesai Hesabı

```
MONTHLY_TARGET = 160 saat/ay

Çalışılan saat = Σ (gündüz × 8) + Σ (gece × 16) + Σ (gece+gündüz × 24)
İzin olan günler hedefi düşürür: hedef -= izin_sayısı × 8

Mesai = Çalışılan saat - Düzeltilmiş hedef
```

Gösterim:
- `+X` → X saat fazla mesai
- `-X` → X saat eksik
- `—` → Tam hedef

---

## Başarı Kriterleri ve Test Kuralları

### Test 1 — Fazla Mesai Eşitliği

```
Koşul:  Fazla çalışan hemşire sayısı ≥ toplam_hemşire × 0.30
Kural:  → Hiçbir hemşire 160 saatin altında kalmamalı
        → En çok ve en az çalışan arasındaki fark ≤ 8 saat olmalı
```

### Test 2 — Hafta Sonu Eşitliği

```
Kural:  max_hafta_sonu_gün - min_hafta_sonu_gün ≤ 1
```

### Test 3 — İzin Günü Eşitliği

```
Kural:  max_boş_gün - min_boş_gün ≤ 1
```

### Genel Değerlendirme

| Sonuç | Açıklama |
|-------|----------|
| ✅ Pass | Kural tam olarak sağlandı |
| ⚠️ Warn | Kural kısmen sağlandı (eşik değerine yakın) |
| ❌ Fail | Kural ihlal edildi |

Sistem **tüm testlerde ✅** olan ilk çizelgeyi değil, **en az 1 test ✅** olan ilk çizelgeyi seçer. Bu, pratik koşullarda algoritmanın hızlı sonuç üretmesini sağlar.

---

## Özet

| Özellik | Değer |
|---------|-------|
| Algoritma türü | Açgözlü (Greedy) günlük atama |
| Deterministik mi? | **Hayır** — rastgelelik içerir |
| Rastgele aralık | 0 – 1.5 puan (hemşire başına gün başına) |
| Maksimum deneme | 20 |
| Tipik başarı | 1–3 denemede |
| Sert kısıt sayısı | 3 |
| Yumuşak kısıt sayısı | 3 (test kuralları) |
| Performans | <100ms (8–12 hemşire) |
