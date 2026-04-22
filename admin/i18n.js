/* Internationalisation — en / ka (Georgian). Loaded first, before all other modules. */
window.CHK = window.CHK || {};

(function () {
  const T = {
    en: {
      /* ── navigation ── */
      back:           "← Back",
      save:           "Save",
      cancel:         "Cancel",
      delete_:        "Delete",
      create:         "Create",
      add:            "+ Add",
      edit:           "Edit",
      close:          "Close",
      confirm:        "Confirm",
      next:           "Next →",
      yes_delete:     "Yes, delete",
      prev:           "← Prev",
      all:            "All",

      /* ── top bar ── */
      tab_open:       "Open checks",
      tab_archive:    "Archive",
      btn_new_check:  "+ New",

      /* ── login ── */
      login_title:    "Login",
      login_sub:      "Staff interface.",
      ph_login:       "login",
      ph_password:    "password",
      btn_login:      "Login",
      forgot_pw:      "Forgot password?",
      logout:         "Logout",

      /* ── forgot / reset password ── */
      forgot_title:   "Reset password",
      forgot_sub:     "Enter your email — we'll send a reset link.",
      ph_email:       "Email",
      btn_send_link:  "Send link",
      forgot_done:    "✓ If this email is registered, a reset link has been sent.",
      reset_title:    "New password",
      reset_sub:      "Enter your new password.",
      ph_new_pw:      "New password",
      btn_set_pw:     "Set password",

      /* ── open checks ── */
      ph_search_open: "Search…",
      no_open_checks: "No open checks. Create a new check.",
      ph_guest_table: "Guest / table",
      new_check_title:"New check",
      name_the_order: "Name the order",
      open_check:     "Open check",
      check_opened:   "Check opened",

      /* ── archive ── */
      ph_arch_search: "Search: guest, item, amount…",
      today:          "Today",
      yesterday:      "Yesterday",
      week:           "Week",
      days_30:        "30 days",
      month_cur:      "This month",
      date_from:      "From…",
      date_to:        "To…",
      no_arch_checks: "No closed checks for this filter.",
      prev_page:      "← Prev",
      next_page:      "Next →",
      unknown_date:   "Unknown date",
      delete_check_q: "Delete this check?",
      deleted:        "Deleted",

      /* ── check screen ── */
      empty_check:    "Empty. Add items below.",
      read_only:      "Read-only",
      fix_item:       "Tap to fix this item",
      adj_qty:        "Adjust quantity",
      remove_item:    "Remove item",
      remove:         "Remove",
      delete_check:   "Delete check?",
      check_deleted:  "Check deleted",
      check_closed:   "Check closed",

      /* ── check form ── */
      ph_item_name:   "Item name…",
      ph_price:       "Price ₾",
      ph_price1:      "Price/1",
      ph_qty:         "Qty",
      ph_total:       "Total",
      added:          "Added",
      price_required: "Price required for new item",
      enter_item:     "Enter item",

      /* ── venue ── */
      staff_title:    "Staff",
      btn_add_staff:  "+ Add",
      catalog_link:   "Product catalog",
      supplies_link:  "Supplies",
      subscription:   "Subscription",
      open_now:       "Open now",
      closed_today:   "Closed today",
      revenue:        "Revenue",
      add_staff:      "Add staff",
      edit_staff:     "Edit staff",
      delete_staff_q: "Delete staff member?",
      name_login_req: "Name and login required",
      ph_staff_name:  "Name",
      ph_staff_login: "Login",
      ph_staff_email: "Email (for password reset)",
      ph_staff_pw:    "New password (leave blank to keep)",
      pw_required:    "Password required",

      /* ── archive stats & pager ── */
      arch_checks:    "Checks",
      arch_avg:       "Avg",
      arch_top:       "Top items",
      pager_of:       "of",
      back_checks:    "← Checks",
      back_archive:   "← Archive",
      check_word:     "Check",

      /* ── venue language setting ── */
      lang_label:     "Interface language",
      lang_en:        "English",
      lang_ka:        "Georgian (ქართული)",

      /* ── catalog ── */
      catalog_title:  "Product catalog",
      btn_scan_menu:  "📷 Scan menu",
      ph_cat_search:  "Search products…",
      no_products:    "No products yet.",
      nothing_found:  "Nothing found.",
      add_product:    "Add product",
      edit_product:   "Edit product",
      ph_prod_name:   "Name",
      ph_prod_cat:    "Category (optional: Beer, Cocktails…)",
      ph_prod_price:  "Price (₾)",
      name_required:  "Name required",
      active_label:   "Active (appears in search)",
      quick_pick:     "Quick pick",
      saved:          "Saved",

      /* ── supplies ── */
      supplies_title: "Supplies",
      btn_new_supply: "+ New",
      no_orders:      "No supply orders yet.",
      close_order_q:  "Close this order?",
      order_closed:   "Order closed",

      /* ── scan ── */
      scan_title:     "Scan",
      fix_item_title: "Fix item",
      ph_scan_name:   "Name",
      ph_scan_price:  "Price ₾",
      ph_scan_qty:    "Qty",
      nothing_in_photo: "Nothing found in photo",
      item_updated:   "Item updated",
      scan_opened:    "Check opened from scan",

      /* ── voice ── */
      perm_denied:    "Microphone permission denied",
      nothing_recog:  "Nothing recognized",
      voice_error:    "Voice error",

      /* ── payment modal ── */
      pay_cash:       "💵 Cash",
      pay_card:       "💳 Card",
      scan_to_view:   "Scan to view",
      total:          "TOTAL",

      /* ── general ── */
      error_prefix:   "Error: ",
      loading:        "Loading…",
    },

    ka: {
      /* ── navigation ── */
      back:           "← უკან",
      save:           "შენახვა",
      cancel:         "გაუქმება",
      delete_:        "წაშლა",
      create:         "შექმნა",
      add:            "+ დამატება",
      edit:           "რედაქტ.",
      close:          "დახურვა",
      confirm:        "დადასტურება",
      next:           "შემდეგი →",
      yes_delete:     "წაშლა",
      prev:           "← წინა",
      all:            "ყველა",

      /* ── top bar ── */
      tab_open:       "ჩეკები",
      tab_archive:    "არქივი",
      btn_new_check:  "+ ახალი",

      /* ── login ── */
      login_title:    "შესვლა",
      login_sub:      "პერსონალის ინტერფეისი.",
      ph_login:       "ლოგინი",
      ph_password:    "პაროლი",
      btn_login:      "შესვლა",
      forgot_pw:      "პაროლი დაგავიწყდა?",
      logout:         "გასვლა",

      /* ── forgot / reset password ── */
      forgot_title:   "პაროლის აღდგენა",
      forgot_sub:     "შეიყვანეთ ელ.ფოსტა — გამოგიგზავნით ლინკს.",
      ph_email:       "ელ.ფოსტა",
      btn_send_link:  "ლინკის გაგზავნა",
      forgot_done:    "✓ თუ ეს ელ.ფოსტა რეგისტრირებულია, ლინკი გაიგზავნა.",
      reset_title:    "ახალი პაროლი",
      reset_sub:      "შეიყვანეთ ახალი პაროლი.",
      ph_new_pw:      "ახალი პაროლი",
      btn_set_pw:     "პაროლის დაყენება",

      /* ── open checks ── */
      ph_search_open: "ძებნა…",
      no_open_checks: "გახსნილი ჩეკი არ არის. შექმენით ახალი.",
      ph_guest_table: "სტუმარი / მაგიდა",
      new_check_title:"ახალი ჩეკი",
      name_the_order: "ჩეკის სახელი",
      open_check:     "ჩეკის გახსნა",
      check_opened:   "ჩეკი გახსნილია",

      /* ── archive ── */
      ph_arch_search: "ძებნა: სტუმარი, პოზიცია, თანხა…",
      today:          "დღეს",
      yesterday:      "გუშინ",
      week:           "კვირა",
      days_30:        "30 დღე",
      month_cur:      "ეს თვე",
      date_from:      "საწყისი…",
      date_to:        "საბოლოო…",
      no_arch_checks: "ამ ფილტრით ჩეკი ვერ მოიძებნა.",
      prev_page:      "← წინა",
      next_page:      "შემდეგი →",
      unknown_date:   "თარიღი უცნობია",
      delete_check_q: "წაშალოთ ეს ჩეკი?",
      deleted:        "წაშლილია",

      /* ── check screen ── */
      empty_check:    "ცარიელია. დაამატეთ პოზიციები.",
      read_only:      "მხოლოდ წაკითხვა",
      fix_item:       "შეასწორეთ ეს პოზიცია",
      adj_qty:        "რაოდენობის შეცვლა",
      remove_item:    "პოზიციის წაშლა",
      remove:         "წაშლა",
      delete_check:   "წაშალოთ ჩეკი?",
      check_deleted:  "ჩეკი წაშლილია",
      check_closed:   "ჩეკი დახურულია",

      /* ── check form ── */
      ph_item_name:   "პოზიციის სახელი…",
      ph_price:       "ფასი ₾",
      ph_price1:      "ფასი/1",
      ph_qty:         "რაოდ.",
      ph_total:       "ჯამი",
      added:          "დამატებულია",
      price_required: "ახალი პოზიციისთვის ფასი სავალდებულოა",
      enter_item:     "პოზიციის შეყვანა",

      /* ── venue ── */
      staff_title:    "პერსონალი",
      btn_add_staff:  "+ დამატება",
      catalog_link:   "პროდუქტის კატალოგი",
      supplies_link:  "მარაგები",
      subscription:   "გამოწერა",
      open_now:       "ახლა ღია",
      closed_today:   "დახ. დღეს",
      revenue:        "შემოსავ.",
      add_staff:      "პერსონალის დამატება",
      edit_staff:     "პერსონალის რედაქტ.",
      delete_staff_q: "წაშალოთ პერსონალი?",
      name_login_req: "სახელი და ლოგინი სავალდებულოა",
      ph_staff_name:  "სახელი",
      ph_staff_login: "ლოგინი",
      ph_staff_email: "ელ.ფოსტა (პაროლის აღდგენა)",
      ph_staff_pw:    "ახალი პაროლი (ცარიელი = ძველი)",
      pw_required:    "პაროლი სავალდებულოა",

      /* ── archive stats & pager ── */
      arch_checks:    "ჩეკები",
      arch_avg:       "საშ.",
      arch_top:       "ტოპ",
      pager_of:       "/",
      back_checks:    "← ჩეკები",
      back_archive:   "← არქივი",
      check_word:     "ჩეკი",

      /* ── venue language setting ── */
      lang_label:     "ინტერფეისის ენა",
      lang_en:        "English",
      lang_ka:        "ქართული",

      /* ── catalog ── */
      catalog_title:  "პროდუქტის კატალოგი",
      btn_scan_menu:  "📷 მენიუს სკანირება",
      ph_cat_search:  "კატალოგის ძებნა…",
      no_products:    "პოზიციები არ არის.",
      nothing_found:  "ვერ მოიძებნა.",
      add_product:    "პოზიციის დამატება",
      edit_product:   "პოზიციის რედაქტ.",
      ph_prod_name:   "სახელი",
      ph_prod_cat:    "კატეგ. (Beer, Cocktails…)",
      ph_prod_price:  "ფასი (₾)",
      name_required:  "სახელი სავალდებულოა",
      active_label:   "აქტიური (ჩანს ძებნაში)",
      quick_pick:     "სწრაფი არჩევა",
      saved:          "შენახულია",

      /* ── supplies ── */
      supplies_title: "მარაგები",
      btn_new_supply: "+ ახალი",
      no_orders:      "შეკვეთები არ არის.",
      close_order_q:  "დახუროთ შეკვეთა?",
      order_closed:   "შეკვეთა დახურულია",

      /* ── scan ── */
      scan_title:     "სკანირება",
      fix_item_title: "პოზიციის გასწორება",
      ph_scan_name:   "სახელი",
      ph_scan_price:  "ფასი ₾",
      ph_scan_qty:    "რაოდ.",
      nothing_in_photo: "ფოტოში ვერ მოიძებნა",
      item_updated:   "პოზიცია განახლებულია",
      scan_opened:    "ჩეკი სკანიდან გახსნილია",

      /* ── voice ── */
      perm_denied:    "მიკროფონი დაბლოკილია",
      nothing_recog:  "ვერ ამოიცნო",
      voice_error:    "ხმოვანი შეცდომა",

      /* ── payment modal ── */
      pay_cash:       "💵 ნაღდი",
      pay_card:       "💳 ბარათი",
      scan_to_view:   "სანახავად დაასკანეთ",
      total:          "ჯამი",

      /* ── general ── */
      error_prefix:   "შეცდომა: ",
      loading:        "იტვირთება…",
    },
  };

  let _lang = "en";

  function t(key) {
    return T[_lang]?.[key] ?? T.en[key] ?? key;
  }

  function setLang(lang, persist) {
    _lang = T[lang] ? lang : "en";
    if (persist !== false) localStorage.setItem("checki_lang", _lang);
    _applyDOM();
    document.documentElement.lang = _lang;
  }

  function _applyDOM() {
    const dict = T[_lang] || T.en;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = dict[el.dataset.i18n];
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const v = dict[el.dataset.i18nPh];
      if (v != null) el.placeholder = v;
    });
  }

  function init() {
    const stored = localStorage.getItem("checki_lang");
    if (stored && T[stored]) _lang = stored;
    _applyDOM();
    document.documentElement.lang = _lang;
  }

  function getLang() { return _lang; }

  window.CHK.i18n = { init, setLang, getLang, t };
  window.CHK.t = t;

  // Apply immediately (before DOMContentLoaded) if DOM already ready
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
