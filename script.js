const navLinks = document.querySelectorAll(".nav-links a[href^='#']");
const sections = document.querySelectorAll("section[id], footer[id]");

const setActiveLink = () => {
  const current = [...sections].find((section) => {
    const rect = section.getBoundingClientRect();
    return rect.top <= 120 && rect.bottom > 120;
  });

  if (!current) return;

  navLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${current.id}`;
    link.classList.toggle("active", isActive);
  });
};

const revealItems = document.querySelectorAll(
  ".section-title, .eyebrow, .specialty-card, .student-card, .finance-card, .faq-item, .contact-card, .map-wrap, .footer-col, .footer-cta"
);

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

revealItems.forEach((item) => {
  item.classList.add("reveal");
  revealObserver.observe(item);
});

window.addEventListener("scroll", setActiveLink, { passive: true });
window.addEventListener("load", setActiveLink);

const faqButtons = document.querySelectorAll(".faq-question");

faqButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const item = button.closest(".faq-item");
    if (!item) return;

    const opened = item.classList.contains("open");
    faqButtons.forEach((otherBtn) => {
      const otherItem = otherBtn.closest(".faq-item");
      if (!otherItem) return;
      otherItem.classList.remove("open");
      otherBtn.setAttribute("aria-expanded", "false");
    });

    if (!opened) {
      item.classList.add("open");
      button.setAttribute("aria-expanded", "true");
    }
  });
});

const faqSearch = document.getElementById("faqSearch");
const faqItems = document.querySelectorAll(".faq-item");
const faqEmpty = document.getElementById("faqEmpty");

if (faqSearch) {
  faqSearch.addEventListener("input", () => {
    const query = faqSearch.value.trim().toLowerCase();
    let visibleCount = 0;

    faqItems.forEach((item) => {
      const text = item.textContent.toLowerCase();
      const matched = text.includes(query);
      item.hidden = !matched;
      if (matched) visibleCount += 1;
    });

    if (faqEmpty) faqEmpty.hidden = visibleCount > 0;
  });
}

const applyModal = document.getElementById("applyModal");
const openModalTriggers = document.querySelectorAll("[data-open-modal]");
const closeModalTriggers = document.querySelectorAll("[data-close-modal]");
const applyForm = document.querySelector(".apply-form");
const formStatus = document.querySelector(".form-status");

// Негізгі сақтау: сервер + SQLite (/api/applications).
// Қосымша (міндетті емес): Telegram хабарлама.
const FORM_CONFIG = {
  apiEndpoint: "/api/applications",
  telegramBotToken: "",
  telegramChatId: ""
};

const openModal = () => {
  if (!applyModal) return;
  applyModal.classList.add("open");
  applyModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

const closeModal = () => {
  if (!applyModal) return;
  applyModal.classList.remove("open");
  applyModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};

openModalTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });
});

closeModalTriggers.forEach((trigger) => {
  trigger.addEventListener("click", closeModal);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

if (applyForm) {
  applyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = applyForm.querySelector("button[type='submit']");
    const formData = new FormData(applyForm);
    const payload = {
      fullName: String(formData.get("fullName") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      major: String(formData.get("major") || "").trim(),
      source: "college-landing-form",
      submittedAt: new Date().toISOString()
    };

    if (formStatus) {
      formStatus.textContent = "";
      formStatus.className = "form-status";
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Жіберілуде...";
    }

    try {
      const response = await fetch(FORM_CONFIG.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Базаға жазу сәтсіз аяқталды");
      }

      if (FORM_CONFIG.telegramBotToken && FORM_CONFIG.telegramChatId) {
        const tgText =
          `Жаңа өтініш\n` +
          `Аты-жөні: ${payload.fullName}\n` +
          `Телефон: ${payload.phone}\n` +
          `Мамандық: ${payload.major || "-"}\n` +
          `Уақыты: ${payload.submittedAt}`;

        await fetch(`https://api.telegram.org/bot${FORM_CONFIG.telegramBotToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: FORM_CONFIG.telegramChatId,
            text: tgText
          })
        });
      }

      if (formStatus) {
        formStatus.textContent = result.message || "Өтініш сәтті жіберілді! Жақын уақытта хабарласамыз.";
        formStatus.classList.add("success");
      }
      applyForm.reset();
      setTimeout(closeModal, 900);
    } catch (error) {
      if (formStatus) {
        formStatus.textContent =
          "Жіберу кезінде қате шықты. Серверді іске қосыңыз: start.bat немесе node server.js";
        formStatus.classList.add("error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Жіберу";
      }
    }
  });
}
