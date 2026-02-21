
'use client';
import { motion } from "framer-motion";
import Link from "next/link";

export default function PrivacyPage() {
  const sections = [
    {
      title: "Introduction",
      content: `This Privacy Policy describes how Sentinel DevOps Agent collects, uses, and protects your information. We are committed to ensuring your privacy and the security of your data while using our platform.`,
    },
    {
      title: "Information We Collect",
      list: [
        "Account information (email address, username)",
        "Usage data and logs for monitoring and analytics",
        "Service and incident data for DevOps automation",
      ],
    },
    {
      title: "How We Use Information",
      list: [
        "To provide and improve our services",
        "To monitor system health and automate incident response",
        "To communicate important updates and notifications",
      ],
    },
    {
      title: "Data Security",
      content: `We implement industry-standard encryption, secure infrastructure, and strict access controls to protect your data from unauthorized access, disclosure, or destruction.`,
    },
    {
      title: "Your Rights",
      list: [
        "Access, update, or delete your personal information",
        "Request transparency about our data practices",
        "Opt out of non-essential communications",
      ],
    },
    {
      title: "Contact Us",
      content: `If you have any questions or concerns about this Privacy Policy, please contact our support team.`,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200 px-6 py-16">

      {/* Back to Home Button */}
      <div className="max-w-4xl mx-auto mb-8 flex justify-start">
        <Link
          href="/"
          className="inline-block px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold shadow transition-colors duration-200"
        >
          ← Back to Home
        </Link>
      </div>

      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent"
        >
          Privacy Policy
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 text-slate-400 max-w-2xl mx-auto"
        >
          Your privacy and data security are our highest priorities at Sentinel DevOps Agent.
        </motion.p>
      </div>

      {/* Content Cards */}
      <div className="max-w-4xl mx-auto space-y-8">
        {sections.map((section, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
            className="group relative p-8 rounded-2xl 
                       bg-slate-900/60 backdrop-blur-lg 
                       border border-slate-800 
                       shadow-lg hover:shadow-cyan-500/10
                       transition-all duration-300"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/0 via-indigo-500/0 to-cyan-500/0 
                            group-hover:from-cyan-500/10 
                            group-hover:via-indigo-500/10 
                            group-hover:to-cyan-500/10 
                            transition-all duration-500 blur-xl opacity-0 group-hover:opacity-100"></div>

            <h2 className="text-2xl font-semibold mb-4 text-cyan-400 group-hover:text-indigo-400 transition-colors duration-300">
              {section.title}
            </h2>

            {section.content && (
              <p className="text-slate-400 leading-relaxed">
                {section.content}
              </p>
            )}

            {section.list && (
              <ul className="space-y-3 text-slate-400">
                {section.list.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 hover:text-slate-200 transition-colors duration-300"
                  >
                    <span className="mt-2 h-2 w-2 rounded-full bg-cyan-400 group-hover:bg-indigo-400 transition-all duration-300"></span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center mt-16 text-slate-500 text-sm">
        © {new Date().getFullYear()} Sentinel DevOps Agent. All rights reserved.
      </div>
    </div>
  );
}