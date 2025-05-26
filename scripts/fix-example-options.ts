import { prisma } from "../src/lib/prisma";

async function fixExampleOptions() {
  console.log("Fixing interactive example options...");
  
  try {
    // Find all multiple choice examples
    const examples = await prisma.interactiveExample.findMany({
      where: {
        questionType: "MULTIPLE_CHOICE"
      }
    });

    console.log(`Found ${examples.length} multiple choice examples`);

    for (const example of examples) {
      const options = example.optionsJson as any;
      
      // Skip if options are already properly formatted
      if (Array.isArray(options) && options.length > 0 && options[0].id && options[0].text) {
        console.log(`Example ${example.exampleId} already has proper format`);
        continue;
      }

      // Fix malformed options
      let fixedOptions = [];
      
      if (Array.isArray(options)) {
        fixedOptions = options.map((opt: any, index: number) => {
          if (typeof opt === 'string') {
            return { id: String.fromCharCode(97 + index), text: opt };
          }
          return {
            id: opt.id || String.fromCharCode(97 + index),
            text: opt.text || opt.toString() || `Option ${index + 1}`
          };
        });
      } else {
        // If options are not an array, create default options
        fixedOptions = [
          { id: 'a', text: 'Option A' },
          { id: 'b', text: 'Option B' },
          { id: 'c', text: 'Option C' },
          { id: 'd', text: 'Option D' }
        ];
      }

      // Update the example
      await prisma.interactiveExample.update({
        where: { exampleId: example.exampleId },
        data: { optionsJson: fixedOptions }
      });

      console.log(`Fixed options for example ${example.exampleId}`);
    }

    console.log("All examples fixed!");
  } catch (error) {
    console.error("Error fixing examples:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixExampleOptions();