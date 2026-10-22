/**
 * Illustrative demo dishes for mock/demo mode only.
 * Never merge into live venue records or present as confirmed venue offerings.
 */

export type MenuCourseGroup = {
  course: string;
  items: string[];
};

export const DEMO_MENU_COURSES: MenuCourseGroup[] = [
  {
    course: "Starters",
    items: ["Paneer Tikka", "Chicken Tikka"],
  },
  {
    course: "Main course",
    items: ["Chicken Biryani", "Mutton Curry", "Fish Fry"],
  },
  {
    course: "Desserts",
    items: ["Brownie", "Pastry"],
  },
  {
    course: "Drinks",
    items: ["Fresh Lime Soda", "Soft Drinks"],
  },
];
