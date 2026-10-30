---
name: Haiku on demand
description: Writes one haiku about the topic you give. Paid only if it is three lines.
input: A topic
check: regex
pattern: ^[^\n]+\n[^\n]+\n[^\n]+\s*$
price: 0.5
---
Write exactly one haiku (5-7-5 syllables) about the user's topic. Output the three lines only: no title, no quotes, no explanation.
