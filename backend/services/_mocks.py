"""Mock AI responses for local development.

Enabled by MOCK_AI=true in .env. Lets you iterate on the UI without
burning Anthropic / Google API calls on every reload.

The mocks are picked at random so dev sessions don't show the same
caption every time — useful for spotting layout issues across
different caption lengths and hashtag counts.
"""

import random


# ── Single-post captions ─────────────────────────────────────────────
# Range of lengths, tones, and emoji density so the UI gets exercised.

POST_CAPTIONS: list[dict] = [
    {
        "caption": "Mornings are best spent like this — a perfectly pulled espresso and a quiet moment before the rush. ☕ Whether you're starting your day or grabbing a midday reset, we're here for it. What's your go-to order? Drop it below 👇",
        "hashtags": ["MorningCoffee", "EspressoShot", "CafeLife", "SmallBusinessLove", "LocalCoffee", "CoffeeRitual"],
    },
    {
        "caption": "Behind every great hair day is a team that gets it. ✨ Our stylists put hours into making sure you walk out feeling like the best version of you — and seeing your smile makes every minute worth it.",
        "hashtags": ["HairTransformation", "SalonLife", "GoldenHour", "HairGoals", "BeautyExperts", "ConfidenceBoost"],
    },
    {
        "caption": "Show up. Sweat. Repeat. 💪\n\nEvery rep counts — and so does every member of our community. Who's training with us tomorrow?",
        "hashtags": ["GymLife", "FitnessCommunity", "TrainHard", "MotivationMonday", "WorkoutGoals", "PushPastLimits"],
    },
    {
        "caption": "New menu drop alert 🚨 — our truffle pasta is finally back on the lineup, and we couldn't be more excited. Hand-rolled, freshly shaved, and worth every second of the wait. Book a table this week and come hungry. 🍝",
        "hashtags": ["NewMenu", "TrufflePasta", "ItalianFood", "FoodieLife", "RestaurantLife", "BookATable"],
    },
    {
        "caption": "Sometimes the small moments are the ones worth sharing. Whether it's a slow Sunday afternoon or a busy Monday morning, we're here for all of it. 💛",
        "hashtags": ["SmallBusiness", "EverydayMoments", "LocalLove", "SupportLocal", "CommunityFirst"],
    },
    {
        "caption": "Saturday energy ⚡ — fresh flowers, golden light, and a space designed to slow you down. Walk-ins welcome all weekend.",
        "hashtags": ["WeekendVibes", "ShopLocal", "DesignedToLast", "WalkInsWelcome", "SaturdayMood"],
    },
    {
        "caption": "Spotted in the wild: one very content customer and a perfectly plated brunch. 🥞 We love seeing your photos — tag us and you might end up on our grid next week.",
        "hashtags": ["CustomerLove", "Brunch", "TagUs", "Foodstagram", "SmallBatchLove"],
    },
    {
        "caption": "Here's to the regulars who feel like family, the first-timers who became friends, and everyone in between. 🥂 Our doors are always open.",
        "hashtags": ["RegularsClub", "FoundFamily", "OpenDoors", "Hospitality", "ThankYou"],
    },
]


# ── Carousel captions ────────────────────────────────────────────────
# Different tone — "carousel" implies a narrative or series, so these
# read like a multi-slide story not a single moment.

CAROUSEL_CAPTIONS: list[dict] = [
    {
        "caption": "A week in our kitchen, told in 5 frames. 👉 From the first pour of espresso at 6am to the last plate sent out at close — every detail matters. Swipe through and see what makes our days worth the early starts.",
        "hashtags": ["BehindTheScenes", "WeekInReview", "KitchenLife", "FoodieDiary", "Hospitality", "SwipeRight"],
    },
    {
        "caption": "Before and after, in their own words. 💫 Three real clients, three real transformations. Swipe to see what a great cut and a little confidence can do.",
        "hashtags": ["BeforeAndAfter", "ClientStories", "HairTransformation", "RealResults", "Confidence", "SwipeForMore"],
    },
    {
        "caption": "A look at the small details you might've missed last week. From the new lighting to the freshly stocked shelves — we've been busy. Swipe through and tell us what you spot first 👀",
        "hashtags": ["ShopUpdates", "NewLook", "SmallDetails", "WelcomeBack", "DesignedWithCare"],
    },
    {
        "caption": "Our team in 6 frames. The pre-shift huddle, the rush, the quick laughs between orders, and the moment we finally sit down at the end of the night. None of this works without them. ❤️",
        "hashtags": ["MeetTheTeam", "PeopleMakeThePlace", "TeamLove", "BehindTheScenes", "FamilyFirst"],
    },
    {
        "caption": "From sketch to shelf — the full journey of our newest piece. 🖌️ Swipe to see how it all came together, from the first concept to the moment it landed in store.",
        "hashtags": ["DesignProcess", "MadeWithLove", "FromSketchToShelf", "SmallBatch", "Craftsmanship"],
    },
]


# ── Public selectors ─────────────────────────────────────────────────
def mock_post_captions(count: int) -> list[dict]:
    """Return N random unique captions. If count > inventory, samples with repeat."""
    if count <= len(POST_CAPTIONS):
        return random.sample(POST_CAPTIONS, k=count)
    return [random.choice(POST_CAPTIONS) for _ in range(count)]


def mock_carousel_caption() -> dict:
    """Return one random carousel caption."""
    return random.choice(CAROUSEL_CAPTIONS)
