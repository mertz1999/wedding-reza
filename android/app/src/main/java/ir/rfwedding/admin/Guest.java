package ir.rfwedding.admin;

import java.util.Locale;

record Guest(long id, String token, String name, String phone, String rsvp) {
    enum Sender {
        PARENTS("از طرف پدر و مادر", "پیوند فرزندمان"),
        COUPLE("از طرف عروس و داماد", "پیوندمان");

        final String label;
        final String celebration;

        Sender(String label, String celebration) {
            this.label = label;
            this.celebration = celebration;
        }
    }

    String invitation(Sender sender) {
        return "سلام و عرض ادب 🌿\n"
            + "با افتخار از شما دعوت می‌کنیم در جشن " + sender.celebration + " در کنارمان باشید.\n"
            + "برای مشاهدهٔ دعوت‌نامهٔ اختصاصی:\n"
            + WeddingApi.ORIGIN + "/i/" + token + "\n"
            + "همچنین خواهشمندیم حضور یا عدم حضور خود را از طریق همان صفحه اعلام فرمایید.";
    }

    String rsvpLabel() {
        return switch (rsvp) {
            case "yes" -> "شرکت می‌کنند";
            case "no" -> "شرکت نمی‌کنند";
            default -> "بدون پاسخ";
        };
    }

    boolean matches(String query) {
        String term = asciiDigits(query.trim()).toLowerCase(Locale.ROOT);
        return name.toLowerCase(Locale.ROOT).contains(term) || asciiDigits(phone).contains(term);
    }

    String smsNumber() {
        String number = asciiDigits(phone).replaceAll("[\\s\\p{Z}()\\p{Pd}]", "");
        if (number.startsWith("00")) number = "+" + number.substring(2);
        return number.matches("\\+?[0-9]{8,15}") ? number : "";
    }

    private static String asciiDigits(String value) {
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            int digit = Character.digit(character, 10);
            result.append(digit < 0 ? character : (char) ('0' + digit));
        }
        return result.toString();
    }
}
