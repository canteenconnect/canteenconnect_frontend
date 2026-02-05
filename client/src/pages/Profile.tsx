import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User, Mail, Shield } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="container mx-auto px-4 max-w-lg py-8 mb-20">
      <h1 className="text-3xl font-display font-bold mb-8">My Profile</h1>

      <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="text-center pb-8 pt-12">
          <div className="mx-auto w-24 h-24 mb-4 relative">
            <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
              <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                {user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-background"></div>
          </div>
          <CardTitle className="text-2xl font-bold">{user.name || user.username}</CardTitle>
          <p className="text-muted-foreground">@{user.username}</p>
        </CardHeader>
        <CardContent className="space-y-6 bg-card/50 backdrop-blur-sm p-6 rounded-t-3xl border-t">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-background rounded-xl border">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Username</p>
                <p className="font-medium">{user.username}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-3 bg-background rounded-xl border">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Role</p>
                <p className="font-medium capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          <Button 
            variant="destructive" 
            className="w-full h-12 rounded-xl text-base font-medium shadow-lg shadow-destructive/20"
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
