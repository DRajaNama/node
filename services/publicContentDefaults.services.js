const BlogPost = require('../models/blogPost.model');
const BlogCategory = require('../models/blogCategory.model');

const DEFAULT_POSTS = [
  {
    title: 'Build a lead capture flow that does more than collect emails',
    slug: 'build-a-useful-lead-capture-flow',
    excerpt: 'A thoughtful form is the start of a relationship. Make the handoff clear, test the experience, and decide what should happen next.',
    category: { name: 'Lead Generation', slug: 'lead-generation', description: 'Practical guidance for capturing and organizing new leads.' },
    tags: ['lead capture', 'forms', 'workflow'],
    content: `<p>A lead capture form should make the next step clear to both the person filling it out and the team receiving the submission. Keep the first interaction focused, ask only for details your team will use, and explain what happens after someone submits.</p>
<h2>Start with the handoff</h2>
<p>Before you design the fields, decide where a new lead should go. In LeadFronter, review the form or landing page destination, then confirm how the contact will be organized for follow-up. A clear destination makes it easier to find submissions and decide who owns the next action.</p>
<h2>Make the form easy to complete</h2>
<ul><li>Use a short, specific heading that explains the value of submitting.</li><li>Ask for only the information needed for the next conversation.</li><li>Use labels that remain visible while someone enters a response.</li><li>Explain any consent or communication preferences in plain language.</li></ul>
<h2>Test before you publish</h2>
<p>Preview the page on a desktop and a phone. Submit a test using an address your team controls, then confirm that the lead appears in the expected workspace. Check the confirmation state and make sure the team knows how to follow up.</p>
<p>Once the basic flow works, connect an automation if a repeatable action is useful. Start with one trigger and one clear action, then review the activity after a test submission.</p>`,
  },
  {
    title: 'A calm, repeatable checklist for launching an email campaign',
    slug: 'email-campaign-launch-checklist',
    excerpt: 'A short review before scheduling can catch the small details that affect the audience, message, and send experience.',
    category: { name: 'Campaigns & Email', slug: 'campaigns-email', description: 'Planning and reviewing email campaigns.' },
    tags: ['email campaigns', 'review', 'checklist'],
    content: `<p>A campaign launch is easier to manage when the review follows the same order each time. Give the audience, content, and delivery settings their own pass instead of trying to catch everything in one preview.</p>
<h2>Check the audience</h2>
<p>Confirm the intended list and review the recipient count. Check that the contacts are current and eligible for the message. If you have changed an audience filter, verify the resulting contacts before you schedule the campaign.</p>
<h2>Read the message as a recipient</h2>
<ul><li>Check the sender name, reply address, and subject.</li><li>Read the message aloud to catch unclear or overly long copy.</li><li>Open every link and check that it leads to the expected destination.</li><li>Review the layout at a narrow screen size.</li><li>Confirm unsubscribe and other required information is present.</li></ul>
<h2>Confirm the send details</h2>
<p>Check the connected email integration and review the date, time, and time zone if you are scheduling. Send a test message when available. After the campaign runs, review its status and delivery activity before making decisions about the next send.</p>
<p>Keep the checklist close to the campaign workflow and update it when your team learns something useful. A consistent review is more reliable than relying on memory during a busy launch.</p>`,
  },
  {
    title: 'When should a lead follow-up become an automation?',
    slug: 'when-to-automate-lead-follow-up',
    excerpt: 'Automation works best for repeatable, well-understood actions. Here is a simple way to decide what to automate first.',
    category: { name: 'Automation', slug: 'automation', description: 'Designing useful and reviewable lead workflows.' },
    tags: ['automation', 'lead follow-up', 'workflows'],
    content: `<p>Automation can make a reliable process easier to repeat, but it cannot make an unclear process effective. Before building a workflow, write down the event that should start it, the decision that matters, and the action your team expects to happen.</p>
<h2>Good first candidates</h2>
<p>Look for routine actions with a clear trigger and a predictable outcome. For example, a new lead may need to be organized into the right place or made visible to the team. In LeadFronter, automation rules are built around triggers, conditions, and actions, so keep the first version focused on one outcome.</p>
<h2>Keep a person in the loop where judgment matters</h2>
<p>Personal replies, sensitive conversations, unusual requests, and decisions that depend on context are often better handled by a person. An automation can help surface the work without pretending to understand every situation.</p>
<h2>Test and review the activity</h2>
<ol><li>Use a test lead that represents the expected input.</li><li>Confirm the trigger and any conditions.</li><li>Check that the intended action completed.</li><li>Review the automation activity and adjust the rule if needed.</li></ol>
<p>Start small, observe the results, and expand only when the workflow is understandable to the people who maintain it.</p>`,
  },
  {
    title: 'Use AI-assisted marketing content with a human review',
    slug: 'review-ai-assisted-marketing-content',
    excerpt: 'AI can help with a first draft. A careful review keeps the final message accurate, appropriate, and consistent with your brand.',
    category: { name: 'Content & AI', slug: 'content-ai', description: 'Using content tools thoughtfully in marketing workflows.' },
    tags: ['AI', 'content review', 'OpenAI'],
    content: `<p>AI-assisted content is most useful when it gives a team a faster starting point. Treat the result as a draft that still needs a knowledgeable person to review it before it is published or sent.</p>
<h2>Give the tool useful context</h2>
<p>Describe the audience, purpose, tone, and format you need. Use examples that your organization has permission to share. Avoid including sensitive personal information, confidential business details, or credentials in a prompt unless your organization has reviewed and approved that use.</p>
<h2>Review the result carefully</h2>
<ul><li>Verify factual statements, names, dates, and product details.</li><li>Check that the language matches your brand and does not imply promises you cannot support.</li><li>Review links, calls to action, accessibility, and mobile presentation.</li><li>Confirm you have the rights and permissions needed for any included material.</li></ul>
<h2>Keep the provider connection secure</h2>
<p>If you connect OpenAI through Integrations, protect the API key like a password. Test the connection in the integration settings and do not copy the key into campaign content, prompts, or support requests. Check the provider's current terms and privacy documentation for details about its services.</p>
<p>AI features can assist with drafting, but your team remains responsible for the final content and its use.</p>`,
  },
];

let seeding;

async function ensureDefaultPublicContent() {
  if (!seeding) {
    seeding = seedDefaultPublicContent().catch((error) => {
      seeding = null;
      throw error;
    });
  }
  return seeding;
}

async function seedDefaultPublicContent() {
  for (const post of DEFAULT_POSTS) {
    const category = await BlogCategory.findOneAndUpdate(
      { slug: post.category.slug },
      { $setOnInsert: post.category },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await BlogPost.findOneAndUpdate(
      { slug: post.slug },
      {
        $setOnInsert: {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          categoryId: category._id,
          tags: post.tags,
          seoTitle: post.title,
          seoDescription: post.excerpt,
          status: 'published',
          publishedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

module.exports = { ensureDefaultPublicContent, DEFAULT_POSTS };
