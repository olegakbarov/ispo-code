/**
 * Skill Registry - manages skill registration and lookup
 *
 * Skills can be registered and looked up by name or trigger phrases.
 */

import type { Skill } from "./types"

class SkillRegistry {
  private skills = new Map<string, Skill>()
  private triggerIndex = new Map<string, string>() // trigger -> skill name

  /**
   * Register a skill
   */
  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      console.warn(`[SkillRegistry] Overwriting existing skill: ${skill.name}`)
    }

    this.skills.set(skill.name, skill)

    // Index triggers for fast lookup
    for (const trigger of skill.triggers) {
      const normalized = this.normalizeTrigger(trigger)
      this.triggerIndex.set(normalized, skill.name)
    }

    console.log(`[SkillRegistry] Registered skill: ${skill.name}`)
  }

  /**
   * Unregister a skill
   */
  unregister(name: string): boolean {
    const skill = this.skills.get(name)
    if (!skill) return false

    // Remove trigger index entries
    for (const trigger of skill.triggers) {
      const normalized = this.normalizeTrigger(trigger)
      this.triggerIndex.delete(normalized)
    }

    this.skills.delete(name)
    return true
  }

  /**
   * Get a skill by name
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  /**
   * Find a skill by trigger phrase
   */
  findByTrigger(input: string): Skill | undefined {
    const normalized = this.normalizeTrigger(input)

    // Exact match first
    const exactMatch = this.triggerIndex.get(normalized)
    if (exactMatch) {
      return this.skills.get(exactMatch)
    }

    // Partial match - check if input contains any trigger
    for (const [trigger, skillName] of this.triggerIndex) {
      if (normalized.includes(trigger) || trigger.includes(normalized)) {
        return this.skills.get(skillName)
      }
    }

    return undefined
  }

  /**
   * Get all registered skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values())
  }

  /**
   * Check if a skill exists
   */
  has(name: string): boolean {
    return this.skills.has(name)
  }

  /**
   * Get skill names
   */
  getNames(): string[] {
    return Array.from(this.skills.keys())
  }

  /**
   * Normalize trigger for matching
   */
  private normalizeTrigger(trigger: string): string {
    return trigger
      .toLowerCase()
      .trim()
      .replace(/^\//, "") // Remove leading slash
      .replace(/\s+/g, " ") // Normalize whitespace
  }

  /**
   * Clear all skills (for testing)
   */
  clear(): void {
    this.skills.clear()
    this.triggerIndex.clear()
  }
}

// Singleton instance
let registryInstance: SkillRegistry | null = null

export function getSkillRegistry(): SkillRegistry {
  if (!registryInstance) {
    registryInstance = new SkillRegistry()
  }
  return registryInstance
}

export { SkillRegistry }
