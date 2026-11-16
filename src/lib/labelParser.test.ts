import { describe, expect, it } from 'vitest';
import { parseLabel } from './labelParser';

describe('parseLabel', () => {
  it('EU / Spanish label, per 100 g with two columns', () => {
    const r = parseLabel(`INFORMACIÓN NUTRICIONAL   Por 100 g   Por porción (30 g)
Valor energético 1550 kJ / 370 kcal   465 kJ / 111 kcal
Grasas 12,5 g 3,8 g
de las cuales saturadas 3,4 g 1,0 g
Hidratos de carbono 55 g 16,5 g
de los cuales azúcares 20 g 6 g
Fibra alimentaria 3 g 0,9 g
Proteínas 8,2 g 2,5 g
Sal 0,45 g 0,14 g`);
    expect(r.basis).toBe('per100');
    expect(r.servingG).toBe(30);
    expect(r.per100).toEqual({ kcal: 370, fat: 12.5, satFat: 3.4, carbs: 55, sugar: 20, fiber: 3, protein: 8.2, salt: 0.45 });
  });

  it('US label, per serving → converted to per 100 g', () => {
    const r = parseLabel(`Nutrition Facts
8 servings per container
Serving size 2/3 cup (55g)
Amount per serving
Calories 230
Total Fat 8g 10%
Saturated Fat 1g 5%
Trans Fat 0g
Cholesterol 0mg 0%
Sodium 160mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g 14%
Total Sugars 12g
Includes 10g Added Sugars 20%
Protein 3g`);
    expect(r.basis).toBe('perServing');
    expect(r.servingG).toBe(55);
    expect(r.raw).toMatchObject({ kcal: 230, fat: 8, satFat: 1, carbs: 37, fiber: 4, sugar: 12, protein: 3, salt: 0.4 });
    expect(r.per100.kcal).toBeCloseTo(418.2, 1);
    expect(r.per100.protein).toBeCloseTo(5.5, 1);
  });

  it('Japanese label with spaced characters and full-width digits', () => {
    const r = parseLabel(`栄 養 成 分 表 示 1袋(45g)当たり
エ ネ ル ギ ー 240kcal
た ん ぱ く 質 3.2g
脂 質 12.5g
炭 水 化 物 30.1g
食 塩 相 当 量 0.4g`);
    expect(r.basis).toBe('perServing');
    expect(r.servingG).toBe(45);
    expect(r.raw).toMatchObject({ kcal: 240, protein: 3.2, fat: 12.5, carbs: 30.1, salt: 0.4 });
  });

  it('German label, kJ/kcal table form', () => {
    const r = parseLabel(`Nährwerte pro 100 g
Brennwert kJ/kcal 1550/370
Fett 12 g
davon gesättigte Fettsäuren 3,4 g
Kohlenhydrate 55 g
davon Zucker 20 g
Ballaststoffe 3 g
Eiweiß 8 g
Salz 0,45 g`);
    expect(r.basis).toBe('per100');
    expect(r.per100).toMatchObject({ kcal: 370, fat: 12, satFat: 3.4, carbs: 55, sugar: 20, fiber: 3, protein: 8 });
  });

  it('value on the following line (split table rows)', () => {
    const r = parseLabel(`Proteínas\n8,2 g\nSal\n<0,01 g`);
    expect(r.per100).toMatchObject({ protein: 8.2, salt: 0.01 });
  });
});
