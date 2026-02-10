"use client"

import { useState } from "react"
import { Upload, Trash2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { mockUsers } from "@/lib/mock-data"

const currentUser = mockUsers[0]

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState(currentUser.display_name)
  const [publicProfile, setPublicProfile] = useState(true)
  const [contactOptIn, setContactOptIn] = useState(true)
  const [emailReminders, setEmailReminders] = useState(true)
  const [emailAvailability, setEmailAvailability] = useState(true)
  const [emailNewsletter, setEmailNewsletter] = useState(false)

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your profile, notifications, and privacy
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Profile */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Profile</CardTitle>
              <CardDescription>
                Your public identity on Flybrary
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
                    CR
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm" className="gap-2 text-foreground bg-transparent">
                    <Upload className="h-4 w-4" />
                    Upload Photo
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG. Max 2MB.
                  </p>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This is your pseudonym visible in the public ledger.
                </p>
              </div>

              <Button className="w-fit gap-2">
                <Save className="h-4 w-4" />
                Save Profile
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">
                Notifications
              </CardTitle>
              <CardDescription>
                Choose what emails you receive
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Return Reminders
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gentle reminder when a book is due back
                  </p>
                </div>
                <Switch
                  checked={emailReminders}
                  onCheckedChange={setEmailReminders}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Book Availability
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Notified when a requested book becomes available
                  </p>
                </div>
                <Switch
                  checked={emailAvailability}
                  onCheckedChange={setEmailAvailability}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Community Updates
                  </p>
                  <p className="text-xs text-muted-foreground">
                    News and updates from the Flybrary network
                  </p>
                </div>
                <Switch
                  checked={emailNewsletter}
                  onCheckedChange={setEmailNewsletter}
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Privacy</CardTitle>
              <CardDescription>
                Control your visibility and data
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Public Profile
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Allow others to view your profile page
                  </p>
                </div>
                <Switch
                  checked={publicProfile}
                  onCheckedChange={setPublicProfile}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    Allow Contact
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Let other members send you messages about books
                  </p>
                </div>
                <Switch
                  checked={contactOptIn}
                  onCheckedChange={setContactOptIn}
                />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-foreground">
                      Delete your account?
                    </DialogTitle>
                    <DialogDescription>
                      This will permanently delete your profile and remove your
                      personal data. Your pseudonymous loan history will remain
                      in the public ledger for transparency purposes, but will
                      no longer be linked to your account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 flex justify-end gap-3">
                    <Button variant="outline" className="text-foreground bg-transparent">Cancel</Button>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete Account
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
