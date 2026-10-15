<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** The admin-editable home page hero: text, background image and up to three banner slides. */
class HomepageSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function upload(string $name = 'hero.jpg'): string
    {
        return $this->post('/api/v1/admin/settings/homepage/images', ['image' => UploadedFile::fake()->image($name, 1600, 900)], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.path');
    }

    public function test_public_settings_carry_the_default_hero(): void
    {
        $this->getJson('/api/v1/public/settings')->assertOk()
            ->assertJsonPath('data.homepage.headline', 'Save more at the stores you love.')
            ->assertJsonPath('data.homepage.search_placeholder', 'Search a store or brand')
            ->assertJsonPath('data.homepage.hero_image_url', null)
            ->assertJsonPath('data.homepage.slides', []);
    }

    public function test_admin_uploads_images_and_saves_text_and_slides(): void
    {
        $this->actingAsAdmin();
        $hero = $this->upload();
        $slide = $this->upload('slide.png');
        $this->assertStringStartsWith('homepage/', $hero);
        Storage::disk('public')->assertExists([$hero, $slide]);

        $saved = $this->putJson('/api/v1/admin/settings/homepage', [
            'headline' => 'Big savings this week',
            'subtext' => 'Fresh codes every morning.',
            'search_placeholder' => 'Find a store',
            'hero_image' => $hero,
            'slides' => [
                ['image' => $slide, 'title' => 'Nike sale', 'subtitle' => '', 'button_text' => 'Shop Nike', 'link' => '/stores/nike', 'extra' => 'dropped'],
            ],
        ])->assertOk()
            ->assertJsonPath('data.headline', 'Big savings this week')
            ->assertJsonPath('data.slides.0.subtitle', null)
            ->assertJsonMissingPath('data.slides.0.extra');
        // Keyed by path; the dots in a path rule out assertJsonPath here.
        $this->assertSame(Storage::disk('public')->url($hero), $saved->json('meta.homepage_image_urls')[$hero]);

        $public = $this->getJson('/api/v1/public/settings')->assertOk();
        $public->assertJsonPath('data.homepage.headline', 'Big savings this week')
            ->assertJsonPath('data.homepage.hero_image_url', Storage::disk('public')->url($hero))
            ->assertJsonPath('data.homepage.slides.0.image_url', Storage::disk('public')->url($slide))
            ->assertJsonPath('data.homepage.slides.0.link', '/stores/nike')
            ->assertJsonMissingPath('data.homepage.hero_image')
            ->assertJsonMissingPath('data.homepage.slides.0.image');
    }

    public function test_replaced_and_removed_images_are_deleted(): void
    {
        $this->actingAsAdmin();
        $old = $this->upload('old.jpg');
        $slide = $this->upload('slide.jpg');
        $this->putJson('/api/v1/admin/settings/homepage', ['hero_image' => $old, 'slides' => [['image' => $slide, 'title' => 'One']]])->assertOk();

        $new = $this->upload('new.jpg');
        $this->putJson('/api/v1/admin/settings/homepage', ['hero_image' => $new, 'slides' => []])->assertOk();

        Storage::disk('public')->assertMissing([$old, $slide]);
        Storage::disk('public')->assertExists($new);
        $this->getJson('/api/v1/public/settings')->assertJsonPath('data.homepage.slides', []);
    }

    public function test_bad_values_are_rejected(): void
    {
        $this->actingAsAdmin();
        $image = $this->upload();
        Storage::disk('public')->put('stores/logo.png', 'x');

        $this->putJson('/api/v1/admin/settings/homepage', ['hero_image' => 'stores/logo.png'])->assertUnprocessable()->assertJsonValidationErrors('hero_image');
        $this->putJson('/api/v1/admin/settings/homepage', ['hero_image' => 'homepage/missing.jpg'])->assertUnprocessable()->assertJsonValidationErrors('hero_image');
        $this->putJson('/api/v1/admin/settings/homepage', ['headline' => ''])->assertUnprocessable()->assertJsonValidationErrors('headline');
        $this->putJson('/api/v1/admin/settings/homepage', ['slides' => [['image' => $image, 'title' => 'x', 'link' => 'javascript:alert(1)']]])
            ->assertUnprocessable()->assertJsonValidationErrors('slides.0.link');
        $this->putJson('/api/v1/admin/settings/homepage', ['slides' => [['image' => $image, 'title' => 'x', 'link' => '//evil.test']]])
            ->assertUnprocessable()->assertJsonValidationErrors('slides.0.link');
        $four = array_fill(0, 4, ['image' => $image, 'title' => 'x']);
        $this->putJson('/api/v1/admin/settings/homepage', ['slides' => $four])->assertUnprocessable()->assertJsonValidationErrors('slides');

        $this->post('/api/v1/admin/settings/homepage/images', ['image' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('image');
    }

    public function test_only_admins_edit_the_homepage(): void
    {
        foreach ([User::factory()->editor()->create(), User::factory()->viewer()->create()] as $staff) {
            Sanctum::actingAs($staff);
            $this->post('/api/v1/admin/settings/homepage/images', ['image' => UploadedFile::fake()->image('x.jpg')], ['Accept' => 'application/json'])->assertForbidden();
            $this->putJson('/api/v1/admin/settings/homepage', ['headline' => 'Nope'])->assertForbidden();
        }
    }
}
