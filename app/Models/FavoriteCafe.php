<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FavoriteCafe extends Model
{
    protected $fillable = [
        'user_id',
        'osm_id',
        'name',
        'latitude',
        'longitude',
        'address'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
