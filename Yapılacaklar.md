# Yapılacaklar

## Otomatik Çizelge

1. Gece (N) çalışan kişi bir sonraki gün boş olmak zorunda (24 saat tutmuş sayılır). D/N çalışan kişi de bir sonraki gün gündüz (D) çalışamaz.
2. Otomatik çizelge oluştururken toplam çalışma saati kullanıcı tarafından değiştirilebilmeli.
3. Otomatik çizelge oluşturulurken ekranda mevcut girilen veri silinmeyecek, üzerine ekleme yapılacak.
4. Otomatik çizelge oluştururken hemşire sayısı yetersiz kalırsa veya bir hemşireye çok fazla görev düşerse kullanıcı uyarılacak.
13. Hemşireler Her ay için listelen silinebilmeli. Örneğin doğum iznine çıkan bir hemşire 3 ay boyunca listede görünmeyecek. yada haziran ayında hastahaneden ayrılan hemşire haziran ayından sonra listede görünmeyecek ancak geçmiş datası uygulamada kalacak.
15. Haftasonu için minimum ve hafta içi için minimum seçenekler ayrı olarak istenecek.



## Hemşire Ayarları

5. Hemşireler izin dışında boş gün talep edebilecek. Otomatik çizelge bu boş günlere dokunmayacak.
6. Hemşireler çalışma isteği (tercih) girebilecek. Otomatik çizelge oluşturulmadan önce bu tercihler girilecek ve oluşturma sırasında dikkate alınacak.
14. Hemşire silinirken hangi aydan itibaren sileceği sorulacak.

## Saat & İzin Kuralları

7. Aylık 160 saat çalışma hedefi olacak. İzin alındığında bu 160 saatten düşecek. Hafta içi izin kullanılabilecek. 160 satin üstü mesai olarak toplam kısmında görünecek.

## Arayüz

8. ✅ Takvimde bir güne tıklandığında aşağı açılır menü çıkacak. Menüde şu seçenekler olacak:
   - D — Gündüz
   - N — Gece
   - D/N — Gündüz/Gece (24 saat)
   - B — Boş (İstekli) — hemşirenin talep ettiği boş gün, `empty`'den ayrı bir state
   - Sİ — Senelik İzin
   - Temizle — hücreyi `empty` (atanmamış) durumuna sıfırlar

9. ~~Tablodaki kısaltmaların (D, N, D/N, B, Sİ) açıklamaları sağ altta bir açıklama kutusunda gösterilecek.~~ ✓ Zaten mevcut (üst bar'da Vardiya Türleri olarak gösteriliyor)

## Dosya İşlemleri

10. PDF olarak kaydedebilme ve kaydedilen PDF'i geri içe aktarabilme özelliği eklenecek.

## Diğer

11. Yeni bir GitHub hesabı açılacak ve proje oraya yüklenecek.
12. Farklı senaryolar için otomatik testler yazılacak.


