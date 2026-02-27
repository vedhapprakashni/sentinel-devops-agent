"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    question: "What is Sentinel?",
    answer:
      "Sentinel is a DevOps agent platform designed to monitor, heal, and automate your infrastructure with ease."
  },
  {
    question: "How do I set up Sentinel?",
    answer:
      "You can set up Sentinel by following the quick-setup guide in the documentation or running the quick-setup.js script in the backend directory."
  },
  {
    question: "Does Sentinel support real-time monitoring?",
    answer:
      "Yes, Sentinel provides real-time monitoring and alerting for your infrastructure."
  },
  {
    question: "Is Sentinel open source?",
    answer:
      "Yes, Sentinel is open source and contributions are welcome!"
  },
  {
    question: "Where can I get support?",
    answer:
      "You can get support by opening an issue on GitHub or checking the FAQ and documentation provided in the project."
  }
];

export function FAQSection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section
      id="faqs"
      className="relative py-28 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#0b1120] border-t border-white/10 overflow-hidden"
    >
      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center mb-20 bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
          Frequently Asked Questions
        </h2>

        <div className="space-y-8">
          {FAQS.map((faq, index) => (
            <PremiumCard
              key={index}
              faq={faq}
              index={index}
              hoveredIndex={hoveredIndex}
              setHoveredIndex={setHoveredIndex}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PremiumCard({
  faq,
  index,
  hoveredIndex,
  setHoveredIndex
}: any) {
  const isOpen = hoveredIndex === index;
  const ref = useRef<HTMLDivElement>(null);

  // Cursor-follow light effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 150, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 150, damping: 20 });

  const handleMouseMove = (e: any) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  // Magnetic hover
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMagnet = (e: any) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = e.clientX - (rect.left + rect.width / 2);
    const offsetY = e.clientY - (rect.top + rect.height / 2);

    x.set(offsetX * 0.05);
    y.set(offsetY * 0.05);
  };

  const resetMagnet = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      layout
      style={{ x, y }}
      onMouseMove={(e) => {
        handleMouseMove(e);
        handleMagnet(e);
      }}
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => {
        setHoveredIndex(null);
        resetMagnet();
      }}
      className="relative rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500"
    >
      {/* Animated Gradient Border */}
      <motion.div
        animate={{ backgroundPosition: isOpen ? "200% center" : "0% center" }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 rounded-2xl opacity-40 blur-lg bg-[length:200%_200%]"
      />

      {/* Glass Morphism Card */}
      <motion.div
        layout
        className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 overflow-hidden"
      >
        {/* Cursor Light - matches background gradient */}
        <motion.div
          className="pointer-events-none absolute w-64 h-64 bg-gradient-to-br from-cyan-400/30 via-indigo-400/30 to-purple-400/30 rounded-full blur-3xl"
          style={{
            left: springX,
            top: springY,
            translateX: "-50%",
            translateY: "-50%"
          }}
        />

        {/* Question */}
        <div className="flex justify-between items-center relative z-10">
          <h3 className="text-lg font-semibold text-white transition-colors duration-300">
            {faq.question}
          </h3>

          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="h-5 w-5 text-cyan-400" />
          </motion.div>
        </div>

        {/* Answer */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-4 text-gray-300 leading-relaxed relative z-10"
            >
              {faq.answer}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}